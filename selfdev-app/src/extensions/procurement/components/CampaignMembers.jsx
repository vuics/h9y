import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'
import { CampaignMemberProgress } from './CampaignMemberProgress'
import { ChevronDown, ChevronRight, MoreVertical } from './icons'
import { readableAgentError } from '../lib/agentText'
import { formatPrice } from '../lib/price'
import { channelLabel } from '../lib/thread'
import { offerBasis, offerNote, priceRanges, splitSuppliers, statusTally, threadsWithOffers } from '../lib/offers'
import { contentOf, memberAwaitsReview, resolveOpen, rowOpenByMode, sectionOpenByMode } from '../lib/memberSections'
import { reviewOpen, reviewSummary } from '../lib/campaignReview'
import { ReviewItem } from './CampaignReview'
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
function SupplierLine({ thread, offer, labels }) {
  return <li className={thread.awaitingPerson ? 'pr-supplier-line is-waiting' : 'pr-supplier-line'}>
    <Link to={`/procurement/negotiations/${thread.assignmentId}`} title={thread.supplierName || thread.assignmentId}>{thread.supplierName || thread.assignmentId}</Link>
    <span className="pr-supplier-line__channel">{channelLabel(thread.channel)}</span>
    {thread.awaitingPerson
      ? <StatusBadge status="NEEDS_REVIEW" label={threadLabel(thread, labels)} compact />
      : <StatusBadge status={thread.status} label={threadLabel(thread, labels)} compact />}
    {offer
      ? <Link className="pr-supplier-line__offer" to={`/procurement/proposals/${offer.id}`}>есть предложение{formatPrice(offer) ? ` · ${formatPrice(offer)}` : ''}</Link>
      : thread.answered && <span className="pr-primary-meta">есть ответ</span>}
  </li>
}

/** One foldable part of an opened position: a header that always says what
 * is inside, and the content only when unfolded. */
function Section({ title, meta, open, onToggle, empty, children }) {
  if (empty) {
    return <div className="pr-member-section is-empty">
      <span className="pr-member-section__head"><span className="pr-member-section__chevron" /><b>{title}</b><span className="pr-member-section__meta">{meta}</span></span>
    </div>
  }
  return <section className={open ? 'pr-member-section is-open' : 'pr-member-section'}>
    <button type="button" className="pr-member-section__head" aria-expanded={open} onClick={onToggle}>
      <span className="pr-member-section__chevron">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      <b>{title}</b>
      <span className="pr-member-section__meta">{meta}</span>
    </button>
    {open && <div className="pr-member-section__body">{children}</div>}
  </section>
}

/** A position opened: its offers, its conversations, its Echemi request.
 *
 * Each is folded or unfolded by the mode above the table, and by hand after
 * that; the headers say enough to decide whether to open one.
 */
function MemberSections({
  member, offers, threads, marketplace, marketplaceLabels, threadStatusLabels, offersLoading,
  isOpen, onToggle, renderMarketplaceActions, renderMarketplaceDetails, renderMarketplaceStatus, browserAccess,
  review, reviewItem, reviewLoading,
}) {
  const { offered } = splitSuppliers(offers, threads)
  const lines = threadsWithOffers(offers, threads)
  const prices = priceRanges(offers)
  return <div className="pr-member-suppliers">
    {/* First, because it is the first step: nobody is written to before it. */}
    <Section
      title="Согласование"
      meta={reviewItem
        ? reviewSummary(reviewItem)
        : reviewLoading ? 'загружаем…' : (memberAwaitsReview(member) ? 'ждёт согласования' : 'кандидаты и RFQ')}
      open={isOpen('review')}
      onToggle={() => onToggle('review')}
    >
      <div className="pr-member-review">
        {reviewItem
          ? <ReviewItem review={review} item={reviewItem} links />
          : <p className="pr-note">{reviewLoading
            ? 'Загружаем согласование…'
            : <>Согласование по этой позиции не найдено. <Link to={`/procurement/requests/${member.cardId}/sourcing`}>Поиск и кандидаты</Link> · <Link to={`/procurement/requests/${member.cardId}/rfq`}>RFQ</Link></>}</p>}
      </div>
    </Section>

    <Section
      title={`Предложения${offered.length ? ` (${offered.length})` : ''}`}
      meta={offered.length ? (prices.length ? prices.join(' · ') : 'цены нет') : (offersLoading ? 'загружаем…' : 'пока нет')}
      empty={!offered.length}
      open={isOpen('offers')}
      onToggle={() => onToggle('offers')}
    >
      <div className="pr-member-offers">
        <div className="pr-table-wrap"><table className="pr-table pr-member-offers__table">
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
        </table></div>
        <Link className="pr-member-offers__compare" to={`/procurement/proposals/compare?cardId=${member.cardId}`}>Сравнить все {offered.length} →</Link>
      </div>
    </Section>

    <Section
      title={`Переписки${threads.length ? ` (${threads.length})` : ''}`}
      meta={threads.length ? statusTally(threads, thread => threadLabel(thread, threadStatusLabels)) : 'пока нет'}
      empty={!threads.length}
      open={isOpen('threads')}
      onToggle={() => onToggle('threads')}
    >
      <ul className="pr-supplier-lines">{lines.map(({ thread, offer }) => <SupplierLine key={thread.assignmentId} thread={thread} offer={offer} labels={threadStatusLabels} />)}</ul>
    </Section>

    {marketplace && <Section
      title="Echemi"
      meta={<>
        {renderMarketplaceStatus
          ? renderMarketplaceStatus(marketplace)
          : <StatusBadge status={marketplace.status} label={marketplaceLabels[marketplace.status] || marketplace.status} compact />}
        {marketplace.platformInquiryId && <span>№ {marketplace.platformInquiryId}</span>}
      </>}
      open={isOpen('echemi')}
      onToggle={() => onToggle('echemi')}
    >
      <div className="pr-member-echemi">
        {/* The actions carry their own way in, so the link is not repeated
            beside them. */}
        {marketplace.status !== 'NEEDS_REVIEW' && <p><Link to={`/procurement/requests/${member.cardId}/echemi`}>Открыть заявку</Link></p>}
        {renderMarketplaceActions?.(marketplace)}
        {renderMarketplaceDetails
          ? <div className="pr-member-echemi__details">{renderMarketplaceDetails(marketplace)}</div>
          : marketplace.error && <p className="pr-import-missing">{readableAgentError(marketplace.error)}</p>}
        {needsMarketplaceAction(member) && browserAccess}
      </div>
    </Section>}
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
  renderMarketplaceActions, renderMarketplaceDetails, renderMarketplaceStatus, browserAccess,
  // How the table is read: which positions and sections a mode unfolds.
  mode = 'members',
  // The approval, loaded once someone asks for it; asking is `onReviewWanted`.
  review = null, reviewLoading = false, onReviewWanted,
  // Searching chosen substances again: the page owns the mutation.
  canResearch, onResearch, researchPending,
}) {
  // What a person opened or folded by hand; a new mode starts from its own rules.
  const [manual, setManual] = useState(() => ({ mode, rows: new Map(), sections: new Map() }))
  // Forgotten on every change of mode, so coming back to one starts clean.
  useEffect(() => { setManual({ mode, rows: new Map(), sections: new Map() }) }, [mode])
  const current = manual.mode === mode ? manual : { mode, rows: new Map(), sections: new Map() }
  const setByHand = (kind, key, value) => setManual(() => {
    const next = { ...current, [kind]: new Map(current[kind]) }
    next[kind].set(key, value)
    return next
  })
  const [selected, setSelected] = useState(() => new Set())
  const counts = filterCounts(members)
  // A legend entry above the table picks the substances of one phase.
  const phase = phaseOfFilter(filter)
  const rows = phase
    ? members.filter(member => memberPhase(member, offersByCard) === phase)
    : filterMembers(members, filter)

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
        const actions = nextActions(member, campaign.campaignId)
        const offers = offersByCard.get(member.cardId)
        const threads = conversationsByCard.get(member.cardId)
        const marketplace = marketplaceByCard.get(member.cardId)
        const reviewItem = review?.items.find(item => item.cardId === member.cardId)
        const content = contentOf({
          offers: offers?.offers, threads: threads?.conversations, marketplace,
          review: reviewItem ? reviewOpen(reviewItem) : memberAwaitsReview(member),
        })
        const expanded = resolveOpen(current.rows, member.cardId, rowOpenByMode(mode, content))
        const toggle = () => setByHand('rows', member.cardId, !expanded)
        const sectionKey = section => `${member.cardId}:${section}`
        const isOpen = section => resolveOpen(current.sections, sectionKey(section), sectionOpenByMode(mode, section))
        const toggleSection = section => {
          if (section === 'review' && !isOpen(section)) onReviewWanted?.()
          setByHand('sections', sectionKey(section), !isOpen(section))
        }
        // «Согласовать» in the row answers here: the position opens on its approval.
        const openReview = () => {
          onReviewWanted?.()
          setManual(() => {
            const rows = new Map(current.rows).set(member.cardId, true)
            const sections = new Map(current.sections).set(sectionKey('review'), true)
            return { ...current, rows, sections }
          })
        }
        return <React.Fragment key={member.cardId}>
          <tr id={`member-${member.cardId}`} className={expanded ? 'pr-members__row is-open' : 'pr-members__row'} data-group={memberGroup(member)}>
            {canResearch && <td className="pr-members__pick">
              <input type="checkbox" checked={selected.has(member.cardId)} aria-label={`Выбрать: ${member.title}`} onChange={() => pick(member.cardId)} />
            </td>}
            <td className="pr-members__toggle">
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={expanded}
                aria-label={`Подробнее: ${member.title}`}
                onPress={toggle}
              >{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</Button>
            </td>
            <td>
              <button type="button" className="pr-members__name" onClick={toggle}>
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
                  ? actions.map(item => (item.review && onReviewWanted
                    ? <button key={item.label} type="button" className="pr-members__action" data-tone={item.tone} onClick={openReview}>{item.label}</button>
                    : <Link key={item.label} className="pr-members__action" data-tone={item.tone} to={item.to}>{item.label}</Link>))
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
          {expanded && <tr className="pr-members__details" data-group={memberGroup(member)}><td colSpan={columns}>
            <MemberSections
              member={member}
              offers={offers?.offers || []}
              threads={threads?.conversations || []}
              marketplace={marketplace}
              marketplaceLabels={marketplaceLabels}
              threadStatusLabels={threadStatusLabels}
              offersLoading={offersLoading}
              isOpen={isOpen}
              onToggle={toggleSection}
              renderMarketplaceActions={renderMarketplaceActions}
              renderMarketplaceDetails={renderMarketplaceDetails}
              renderMarketplaceStatus={renderMarketplaceStatus}
              browserAccess={browserAccess}
              review={review}
              reviewItem={reviewItem}
              reviewLoading={reviewLoading}
            />
          </td></tr>}
        </React.Fragment>
      })}</tbody>
    </table></div>
    {!rows.length && <p className="pr-note">Под этот фильтр веществ нет.</p>}
  </section>
}
