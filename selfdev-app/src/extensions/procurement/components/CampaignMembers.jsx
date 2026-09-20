import React, { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'
import { CampaignMemberProgress } from './CampaignMemberProgress'
import { ChevronDown, ChevronRight } from './icons'
import { readableAgentError } from '../lib/agentText'
import {
  FILTERS, filterCounts, filterMembers, foundSummary, memberGroup, nextAction, requestsSummary,
} from '../lib/campaignView'
import { plural } from './SourcingSettings'

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
        <th title="Кандидатов · из них с контактами · подтверждено">Найдено</th>
        <th title="Запросов отправлено → ответов получено">Запросы</th>
        <th>Предложения</th>
        <th>Что дальше</th>
        {canRemove && <th aria-label="Убрать" />}
      </tr></thead>
      <tbody>{rows.map(member => {
        const expanded = open.has(member.cardId)
        const action = nextAction(member, campaign.campaignId)
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
            <td>{foundSummary(member)}</td>
            <td>{requestsSummary(member)}</td>
            <td className="pr-members__offers">
              {offers?.prices.length
                ? <>
                  <strong>{offers.prices[0]}</strong>
                  <span className="pr-primary-meta">{offers.priced} с ценой из {offers.offers.length}</span>
                </>
                : offers
                  ? <span className="pr-primary-meta">{offers.offers.length} {plural(offers.offers.length, 'ответ', 'ответа', 'ответов')}, цены нет</span>
                  : <span className="pr-muted">{offersLoading ? '…' : '—'}</span>}
            </td>
            <td>
              {action
                ? <Link className="pr-members__action" data-tone={action.tone} to={action.to}>{action.label}</Link>
                : <span className="pr-muted">—</span>}
            </td>
            {canRemove && <td>{removable(member) && <Button
              variant="ghost"
              size="sm"
              aria-label={`Убрать ${member.title} из кампании`}
              isDisabled={removePending}
              onPress={() => onRemove(member.cardId)}
            >Убрать</Button>}</td>}
          </tr>
          {expanded && <tr className="pr-members__details"><td colSpan={canRemove ? 8 : 7}>
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
                  ? <p>
                    <StatusBadge status={marketplace.status} label={marketplaceLabels[marketplace.status] || marketplace.status} compact />
                    {marketplace.platformInquiryId && <span className="pr-primary-meta"> номер на площадке: {marketplace.platformInquiryId}</span>}
                    {marketplace.error && <span className="pr-import-missing"> {readableAgentError(marketplace.error)}</span>}
                    {' '}<Link to={`/procurement/requests/${member.cardId}/echemi`}>открыть заявку</Link>
                  </p>
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
