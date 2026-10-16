import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'
import { CampaignMemberProgress } from './CampaignMemberProgress'
import { ChevronDown, ChevronRight, MoreVertical } from './icons'
import { readableAgentError } from '../lib/agentText'
import { formatPrice } from '../lib/price'
import { channelLabel } from '../lib/thread'
import { offerBasis, offerNote, splitSuppliers, statusTally } from '../lib/offers'
import {
  FILTERS, filterCounts, filterMembers, foundSummary, memberGroup, needsMarketplaceAction,
  nextActions, requestsSummary,
} from '../lib/campaignView'
import { plural } from './SourcingSettings'
import { memberPhase, phaseLabel, phaseOfFilter } from '../lib/campaignPhases'

/** The per-substance actions nobody needs while reading the table.
 *
 * Positioned against the viewport rather than the row: the table scrolls
 * inside its own box, and a menu laid out inside it is cut off at the edge.
 */
function RowMenu({ label, children }) {
  const [at, setAt] = useState(null)
  const button = useRef(null)
  const menu = useRef(null)
  useEffect(() => {
    if (!at) return undefined
    const close = event => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menu.current?.contains(event.target)) setAt(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', () => setAt(null), { once: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [at])
  const open = () => {
    const rect = button.current?.getBoundingClientRect()
    setAt(rect ? { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) } : null)
  }
  return <>
    <button
      ref={button}
      type="button"
      className="pr-row-menu__trigger"
      aria-label={label}
      aria-expanded={Boolean(at)}
      onClick={() => (at ? setAt(null) : open())}
    ><MoreVertical size={16} /></button>
    {at && <div ref={menu} className="pr-row-menu" role="menu" style={{ top: at.top, right: at.right }} onClick={() => setAt(null)}>
      {children}
    </div>}
  </>
}

/** What a person says about a conversation's state, in the row's own words. */
const threadLabel = (thread, labels) => (thread.awaitingPerson
  ? (thread.automationPaused ? 'агент остановлен' : 'ждёт отправки')
  : labels[thread.status] || thread.status)

/** One conversation on one line: who, through what, where it stands. */
function SupplierLine({ thread, labels }) {
  return <li className={thread.awaitingPerson ? 'pr-supplier-line is-waiting' : 'pr-supplier-line'}>
    <Link to={`/procurement/negotiations/${thread.assignmentId}`} title={thread.supplierName || thread.assignmentId}>{thread.supplierName || thread.assignmentId}</Link>
    <span className="pr-supplier-line__channel">{channelLabel(thread.channel)}</span>
    {thread.awaitingPerson
      ? <StatusBadge status="NEEDS_REVIEW" label={threadLabel(thread, labels)} compact />
      : <StatusBadge status={thread.status} label={threadLabel(thread, labels)} compact />}
    {thread.answered && <span className="pr-primary-meta">есть ответ</span>}
  </li>
}

/** A substance opened: the offers first, then who has not answered, then Echemi.
 *
 * The offers are what the row is opened for, so they are a table in the
 * columns a buyer compares. Everybody else is one line each, folded behind a
 * tally — unless one of them waits for a person, which is never folded away.
 */
function MemberSuppliers({
  member, offers, threads, marketplace, marketplaceLabels, threadStatusLabels, offersLoading,
  renderMarketplaceActions, browserAccess,
}) {
  const { offered, silent } = splitSuppliers(offers, threads)
  const waiting = silent.some(thread => thread.awaitingPerson)
  return <div className="pr-member-suppliers">
    {offered.length > 0
      ? <div className="pr-member-offers">
        <table className="pr-member-offers__table">
          <thead><tr>
            <th>Поставщик</th><th>Цена</th><th>Базис</th><th>Количество</th><th>Чистота</th><th>Срок</th><th>Примечание</th>
          </tr></thead>
          <tbody>{offered.map(({ offer, thread }) => <tr key={offer.id}>
            <td>
              {thread
                ? <Link to={`/procurement/negotiations/${thread.assignmentId}`}>{offer.supplierName}</Link>
                : <span>{offer.supplierName}</span>}
              {thread && <span className="pr-supplier-line__channel">{channelLabel(thread.channel)}</span>}
            </td>
            <td className="pr-member-offers__price">
              <Link to={`/procurement/proposals/${offer.id}`} title="Открыть предложение">{formatPrice(offer) || 'цены нет'}</Link>
            </td>
            <td>{offerBasis(offer) || '—'}</td>
            <td>{offer.quantity || '—'}</td>
            <td>{[offer.purity || offer.grade, offer.coa === 'PROVIDED' && 'CoA'].filter(Boolean).join(', ') || '—'}</td>
            <td>{offer.leadTime || '—'}</td>
            <td className="pr-member-offers__note">{offerNote(offer)}</td>
          </tr>)}</tbody>
        </table>
        <Link className="pr-member-offers__compare" to={`/procurement/proposals/compare?cardId=${member.cardId}`}>Сравнить все {offered.length} →</Link>
      </div>
      : <p className="pr-note">{offersLoading ? 'Загружаем предложения…' : 'Предложений по этому веществу пока нет.'}</p>}

    {silent.length > 0 && <details className="pr-member-silent" open={waiting || undefined}>
      <summary>
        <b>Без предложения: {silent.length}</b>
        <span className="pr-member-silent__tally"> · {statusTally(silent, thread => threadLabel(thread, threadStatusLabels))}</span>
      </summary>
      <ul className="pr-supplier-lines">{silent.map(thread => <SupplierLine key={thread.assignmentId} thread={thread} labels={threadStatusLabels} />)}</ul>
    </details>}
    {!threads.length && !offered.length && <p className="pr-note">Переписок по этому веществу пока нет.</p>}

    {marketplace && <div className="pr-member-echemi">
      <div className="pr-supplier-line">
        <b>Echemi</b>
        <span className="pr-supplier-line__channel">площадка</span>
        <StatusBadge status={marketplace.status} label={marketplaceLabels[marketplace.status] || marketplace.status} compact />
        {marketplace.platformInquiryId && <span className="pr-primary-meta">№ {marketplace.platformInquiryId}</span>}
        {/* The actions below carry their own way in, so the link is not
            repeated beside them. */}
        {marketplace.status !== 'NEEDS_REVIEW' && <Link to={`/procurement/requests/${member.cardId}/echemi`}>открыть заявку</Link>}
      </div>
      {marketplace.error && <p className="pr-import-missing">{readableAgentError(marketplace.error)}</p>}
      {/* The same presses as the box below the table, here for the one
          substance the reader is looking at. */}
      {renderMarketplaceActions?.(marketplace)}
      {needsMarketplaceAction(member) && browserAccess}
    </div>}
  </div>
}

/** The campaign's substances, and everything about one of them on demand.
 *
 * This table is why the page is opened, so it comes first and carries what
 * used to be two long blocks below it: a substance's conversations and its
 * marketplace request now live inside its own row.
 */
export function CampaignMembers({
  campaign, members, stageLabels, marketplaceLabels, threadStatusLabels,
  conversationsByCard, marketplaceByCard, offersByCard, offersLoading,
  canRemove, removable, onRemove, removePending, filter, onFilterChange,
  // The marketplace actions and the browser access are owned by the page,
  // which holds their mutations; the row only says where they belong.
  renderMarketplaceActions, browserAccess,
  // Searching chosen substances again: the page owns the mutation.
  canResearch, onResearch, researchPending,
}) {
  const [open, setOpen] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())
  const counts = filterCounts(members)
  // A legend entry above the table picks the substances of one phase.
  const phase = phaseOfFilter(filter)
  const rows = phase
    ? members.filter(member => memberPhase(member, offersByCard) === phase)
    : filterMembers(members, filter)
  const toggle = cardId => setOpen(current => {
    const next = new Set(current)
    if (next.has(cardId)) next.delete(cardId)
    else next.add(cardId)
    return next
  })

  const visible = rows.map(member => member.cardId)
  const allVisible = visible.length > 0 && visible.every(cardId => selected.has(cardId))
  const pick = cardId => setSelected(current => {
    const next = new Set(current)
    if (next.has(cardId)) next.delete(cardId)
    else next.add(cardId)
    return next
  })
  const pickVisible = () => setSelected(current => {
    const next = new Set(current)
    for (const cardId of visible) {
      if (allVisible) next.delete(cardId)
      else next.add(cardId)
    }
    return next
  })
  const columns = canResearch ? 9 : 8

  return <section className="pr-members">
    <div className="pr-members__filters" role="group" aria-label="Показать вещества">
      {FILTERS.filter(([id]) => id === 'all' || counts[id] > 0).map(([id, label]) => <button
        key={id}
        type="button"
        className={filter === id ? 'pr-chip is-on' : 'pr-chip'}
        data-filter={id}
        aria-pressed={filter === id}
        onClick={() => onFilterChange(id)}
      >{label} <b>{counts[id]}</b></button>)}
      {phase && <button
        type="button"
        className="pr-chip is-on"
        data-filter={filter}
        aria-pressed="true"
        title="Показать все"
        onClick={() => onFilterChange('all')}
      >{phaseLabel(phase)} <b>{rows.length}</b> ✕</button>}
    </div>

    {canResearch && selected.size > 0 && <div className="pr-members__bulk" role="region" aria-label="Выбранные вещества">
      <span>Выбрано: <b>{selected.size}</b></span>
      <Button
        size="sm"
        isDisabled={researchPending}
        onPress={() => onResearch([...selected], () => setSelected(new Set()))}
      >{researchPending ? 'Запускаем…' : `Искать заново (${selected.size})`}</Button>
      <Button size="sm" variant="ghost" onPress={() => setSelected(new Set())}>Снять выбор</Button>
      <span className="pr-muted">С текущими настройками закупки — глубина, движки, запросы. Найденное сольётся с прежним поиском; решения по кандидатам сохранятся. Вещества, где поиск уже идёт, пропускаются.</span>
    </div>}

    <div className="pr-table-wrap"><table className="pr-table pr-members__table">
      <thead><tr>
        {canResearch && <th className="pr-members__pick">
          <input type="checkbox" checked={allVisible} aria-label="Выбрать все показанные вещества" onChange={pickVisible} />
        </th>}
        <th aria-label="Развернуть" />
        <th>Вещество</th>
        <th>Этап</th>
        <th title="Найдено кандидатов · из них с адресом · подтверждено поставщиками. Подтвердить можно и компанию без адреса, поэтому третье число бывает больше второго">Кандидаты</th>
        <th title="Запросов отправлено → ответов получено">Запросы</th>
        <th>Предложения</th>
        <th>Что дальше</th>
        <th aria-label="Действия" />
      </tr></thead>
      <tbody>{rows.map(member => {
        const expanded = open.has(member.cardId)
        const actions = nextActions(member, campaign.campaignId)
        const offers = offersByCard.get(member.cardId)
        const threads = conversationsByCard.get(member.cardId)
        const marketplace = marketplaceByCard.get(member.cardId)
        return <React.Fragment key={member.cardId}>
          <tr className={expanded ? 'pr-members__row is-open' : 'pr-members__row'} data-group={memberGroup(member)}>
            {canResearch && <td className="pr-members__pick">
              <input type="checkbox" checked={selected.has(member.cardId)} aria-label={`Выбрать: ${member.title}`} onChange={() => pick(member.cardId)} />
            </td>}
            <td className="pr-members__toggle">
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={expanded}
                aria-label={`Подробнее: ${member.title}`}
                onPress={() => toggle(member.cardId)}
              >{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</Button>
            </td>
            <td>
              <button type="button" className="pr-members__name" onClick={() => toggle(member.cardId)}>
                {member.title}
              </button>
              <div className="pr-primary-meta">
                <Link to={`/procurement/requests/${member.cardId}`}>#{member.cardId}</Link>
                <span>· CAS {member.casNumber || 'не указан'}</span>
                {needsMarketplaceAction(member) && <span className="pr-members__flag" title="Заявка на площадке ждёт человека — раскройте строку">Echemi</span>}
              </div>
            </td>
            <td><div className="pr-member-stage-cell">
              <StatusBadge status={member.stage} label={stageLabels[member.stage] || member.stage} />
              <CampaignMemberProgress
                stage={member.stage}
                stepProgress={member.stepProgress}
                waitingFor={member.waitingFor}
                errorCode={member.errorCode}
                paused={campaign.status === 'PAUSED'}
              />
            </div></td>
            <td title={member.candidateCount ? `${member.candidateCount} найдено · ${member.contactCount || 0} с адресом · ${member.verifiedCount || 0} подтверждено` : undefined}>{foundSummary(member)}</td>
            <td>{requestsSummary(member)}</td>
            <td className="pr-members__offers">
              {/* The prices open the comparison they came from: that table is
                  the result the whole purchase is run for. */}
              {offers
                ? <Link to={`/procurement/proposals/compare?cardId=${member.cardId}`} title="Открыть сравнение предложений">
                  {offers.prices.length
                    ? <>
                      <strong>{offers.prices[0]}</strong>
                      <span className="pr-primary-meta">{offers.priced} с ценой из {offers.offers.length} · сравнить</span>
                    </>
                    : <span className="pr-primary-meta">{offers.offers.length} {plural(offers.offers.length, 'ответ', 'ответа', 'ответов')}, цены нет · сравнить</span>}
                </Link>
                : <span className="pr-muted">{offersLoading ? '…' : '—'}</span>}
            </td>
            <td>
              {/* The flex box is inside the cell, not the cell itself: a
                  `display: flex` on a <td> takes it out of the table layout,
                  and the column stops lining up with its own row. */}
              <div className="pr-members__actions">
                {actions.length
                  ? actions.map(item => <Link key={item.label} className="pr-members__action" data-tone={item.tone} to={item.to}>{item.label}</Link>)
                  : <span className="pr-muted">—</span>}
              </div>
            </td>
            <td className="pr-members__menu">
              <RowMenu label={`Ещё по веществу: ${member.title}`}>
                <Link to={`/procurement/requests/${member.cardId}`} role="menuitem">Карточка позиции</Link>
                {member.sourcingRunId && <Link to={`/procurement/requests/${member.cardId}/sourcing`} role="menuitem">Поиск и кандидаты</Link>}
                <Link to={`/procurement/requests/${member.cardId}/rfq`} role="menuitem">RFQ</Link>
                {offers?.offers.length > 0 && <Link to={`/procurement/proposals/compare?cardId=${member.cardId}`} role="menuitem">Сравнить предложения ({offers.offers.length})</Link>}
                {member.escalationCount > 0 && <Link to={`/procurement/escalations?cardId=${member.cardId}`} role="menuitem">Эскалации ({member.escalationCount})</Link>}
                {canRemove && removable(member) && <button
                  type="button"
                  role="menuitem"
                  className="pr-row-menu__danger"
                  disabled={removePending}
                  onClick={() => onRemove(member.cardId)}
                >Убрать из закупки</button>}
              </RowMenu>
            </td>
          </tr>
          {expanded && <tr className="pr-members__details"><td colSpan={columns}>
            <MemberSuppliers
              member={member}
              offers={offers?.offers || []}
              threads={threads?.conversations || []}
              marketplace={marketplace}
              marketplaceLabels={marketplaceLabels}
              threadStatusLabels={threadStatusLabels}
              offersLoading={offersLoading}
              renderMarketplaceActions={renderMarketplaceActions}
              browserAccess={browserAccess}
            />
          </td></tr>}
        </React.Fragment>
      })}</tbody>
    </table></div>
    {!rows.length && <p className="pr-note">Под этот фильтр веществ нет.</p>}
  </section>
}
