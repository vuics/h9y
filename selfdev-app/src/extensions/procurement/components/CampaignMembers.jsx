import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'
import { CampaignMemberProgress } from './CampaignMemberProgress'
import { ChevronDown, ChevronRight, Gear } from './icons'
import { readableAgentError } from '../lib/agentText'
import {
  FILTERS, filterCounts, filterMembers, foundSummary, memberGroup, needsMarketplaceAction,
  nextActions, requestsSummary,
} from '../lib/campaignView'
import { plural } from './SourcingSettings'

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
    ><Gear size={16} /></button>
    {at && <div ref={menu} className="pr-row-menu" role="menu" style={{ top: at.top, right: at.right }} onClick={() => setAt(null)}>
      {children}
    </div>}
  </>
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
}) {
  const [open, setOpen] = useState(() => new Set())
  const counts = filterCounts(members)
  const rows = filterMembers(members, filter)
  const toggle = cardId => setOpen(current => {
    const next = new Set(current)
    if (next.has(cardId)) next.delete(cardId)
    else next.add(cardId)
    return next
  })

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
    </div>

    <div className="pr-table-wrap"><table className="pr-table pr-members__table">
      <thead><tr>
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
              <RowMenu label={`Действия: ${member.title}`}>
                <Link to={`/procurement/requests/${member.cardId}`} role="menuitem">Карточка закупки</Link>
                {member.sourcingRunId && <Link to={`/procurement/requests/${member.cardId}/sourcing`} role="menuitem">Поиск и кандидаты</Link>}
                <Link to={`/procurement/requests/${member.cardId}/rfq`} role="menuitem">RFQ</Link>
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
          {expanded && <tr className="pr-members__details"><td colSpan={8}>
            <div className="pr-members__panel">
              <div>
                <h4>Переписки</h4>
                {threads?.conversations?.length
                  ? <ul className="pr-plain-list">{threads.conversations.map(thread => <li key={thread.assignmentId}>
                    <Link to={`/procurement/negotiations/${thread.assignmentId}`}>{thread.supplierName || thread.assignmentId}</Link>
                    <span className="pr-primary-meta"> {thread.channel}{thread.answered ? ' · есть ответ' : ''}</span>
                    {thread.awaitingPerson
                      ? <StatusBadge status="NEEDS_REVIEW" label={thread.automationPaused ? 'агент остановлен' : 'ждёт отправки'} compact />
                      : <StatusBadge status={thread.status} label={threadStatusLabels[thread.status] || thread.status} compact />}
                  </li>)}</ul>
                  : <p className="pr-note">Переписок по этому веществу пока нет.</p>}
              </div>
              <div>
                <h4>Заявка на площадку</h4>
                {marketplace
                  ? <div className="pr-members__marketplace">
                    <p>
                      <StatusBadge status={marketplace.status} label={marketplaceLabels[marketplace.status] || marketplace.status} compact />
                      {marketplace.platformInquiryId && <span className="pr-primary-meta"> номер на площадке: {marketplace.platformInquiryId}</span>}
                      {/* The actions below carry their own way in, so the
                          link is not repeated beside them. */}
                      {marketplace.status !== 'NEEDS_REVIEW' && <>{' '}<Link to={`/procurement/requests/${member.cardId}/echemi`}>открыть заявку</Link></>}
                    </p>
                    {marketplace.error && <p className="pr-import-missing">{readableAgentError(marketplace.error)}</p>}
                    {/* The same presses as the box below the table, here for
                        the one substance the reader is looking at. */}
                    {renderMarketplaceActions?.(marketplace)}
                    {needsMarketplaceAction(member) && browserAccess}
                  </div>
                  : <p className="pr-note">Заявка на площадку по этому веществу не готовилась.</p>}
              </div>
              <div>
                <h4>Ещё по веществу</h4>
                <ul className="pr-plain-list">
                  <li><Link to={`/procurement/requests/${member.cardId}`}>Карточка закупки</Link></li>
                  {member.sourcingRunId && <li><Link to={`/procurement/requests/${member.cardId}/sourcing`}>Поиск и кандидаты</Link></li>}
                  <li><Link to={`/procurement/requests/${member.cardId}/rfq`}>RFQ</Link></li>
                  {offers?.offers.length > 0 && <li><Link to={`/procurement/proposals/compare?cardId=${member.cardId}`}>Сравнить предложения ({offers.offers.length})</Link></li>}
                  {member.escalationCount > 0 && <li><Link to={`/procurement/escalations?cardId=${member.cardId}`}>Эскалации ({member.escalationCount})</Link></li>}
                </ul>
              </div>
            </div>
          </td></tr>}
        </React.Fragment>
      })}</tbody>
    </table></div>
    {!rows.length && <p className="pr-note">Под этот фильтр веществ нет.</p>}
  </section>
}
