import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { Pagination } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { ThreadPreview } from '../components/ThreadPreview'
import { plural } from '../components/SourcingSettings'
import { AlertTriangle, ChevronDown, ChevronRight } from '../components/icons'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CopyableId } from '../components/CopyableId'
import { escalationKind, escalationSubject } from '../lib/escalation'

// Opened without a filter, the page shows what still needs a person — every
// open status at once — rather than a history where decided cases bury them.
const ACTIVE = 'ACTIVE'
const STATUSES = [
  { value: ACTIVE, label: 'Ждут решения' },
  { value: 'OPEN', label: 'Открыта' },
  { value: 'IN_REVIEW', label: 'На рассмотрении' },
  { value: 'RECOMMENDED', label: 'Есть рекомендация' },
  { value: 'RESOLVED', label: 'Решена' },
  { value: 'ALL', label: 'Все, включая решённые' },
]

/** Purchases stopped at the one approval screen: part of "what waits for me". */
function PendingApprovals() {
  const query = useQuery({ queryKey: procurementKeys.campaigns(), queryFn: ({ signal }) => procurementApi.campaigns(signal) })
  const waiting = (query.data?.items || []).filter(item => item.status !== 'CANCELLED' && item.progress?.awaitingReview > 0)
  if (!waiting.length) return null
  return <section className="pr-stack" aria-label="Согласование закупок">
    <h3>Согласование закупок</h3>
    <div className="pr-approval-list">{waiting.map(item => {
      const count = item.progress.awaitingReview
      return <Card key={item.campaignId} className="pr-approval"><CardContent>
        <div><strong>{item.title}</strong><span>Кому пишем и что спрашиваем: ждут {count} {plural(count, 'вещество', 'вещества', 'веществ')}</span></div>
        <RouterLinkButton to={`/procurement/campaigns/${item.campaignId}/review`}>Согласовать {count} {plural(count, 'вещество', 'вещества', 'веществ')}</RouterLinkButton>
      </CardContent></Card>
    })}</div>
  </section>
}

function EscalationItem({ item, selected }) {
  const [thread, setThread] = useState(false)
  return <Card className={selected ? 'pr-escalation pr-escalation--selected' : 'pr-escalation'}><CardContent>
    <div className="pr-priority"><AlertTriangle size={16} /><strong>{item.priority}</strong><span>приоритет</span></div>
    <div className="pr-escalation__body">
      <div className="pr-escalation__heading">
        <div><h3 className="pr-escalation__subject"><Link to={`/procurement/escalations/${item.id}`}>{escalationSubject(item)}</Link></h3><p className="pr-escalation__kind">{escalationKind(item)}</p></div>
        <StatusBadge status={item.status} />
      </div>
      <p>{item.recommendation}</p>
      <div className="pr-risk-list">{item.risks.map(risk => <div key={risk.code}><strong>{risk.reason}</strong>{risk.evidence?.length > 0 && <blockquote>{risk.evidence[0]}</blockquote>}</div>)}</div>
      <div className="pr-inline-actions">
        {item.status !== 'RESOLVED' && <RouterLinkButton to={`/procurement/escalations/${item.id}`}>Решить<ChevronRight size={15} /></RouterLinkButton>}
        {item.negotiationId && <Button variant="outline" aria-expanded={thread} onPress={() => setThread(value => !value)}>
          Переписка<ChevronDown size={15} className={thread ? 'pr-rotate' : undefined} />
        </Button>}
      </div>
      {thread && <ThreadPreview negotiationId={item.negotiationId} />}
      <div className="pr-escalation__relations"><Link to={`/procurement/requests/${item.cardId}`}>Карточка #{item.cardId}</Link><span>·</span><Link to={`/procurement/suppliers/${item.supplierId}`}>{item.supplierName}</Link><span>·</span><CopyableId value={item.id} /></div>
      <footer><span>Создано {new Date(item.createdAt).toLocaleString('ru-RU')}</span><span>Ответственный: {item.assignedTo || 'не назначен'}</span></footer>
    </div>
  </CardContent></Card>
}

export default function EscalationsPage() {
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const status = filters.status || ACTIVE
  const request = { ...filters, status }
  const query = useQuery({ queryKey: procurementKeys.escalations(request), queryFn: ({ signal }) => procurementApi.escalations(request, signal), keepPreviousData: true })
  return <div className="pr-stack">
    <div className="pr-section-heading"><div><h2>Эскалации</h2><p>Решения, которые агент не вправе принимать без вас. Переписка раскрывается прямо здесь.</p></div></div>
    <PendingApprovals />
    <ListFilters
      filters={{ ...filters, status }}
      // «Все статусы» of the shared control means every case, decided ones too.
      onChange={patch => setFilters('status' in patch ? { ...patch, status: patch.status === ACTIVE ? '' : patch.status || 'ALL' } : patch)}
      statuses={STATUSES}
      placeholder="Вещество, причина, поставщик или ESC-ID"
    />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !query.data.items.length ? <EmptyState title={status === ACTIVE ? 'Всё решено' : 'Ничего не найдено'} description={status === ACTIVE ? 'Открытых эскалаций нет — агент работает сам.' : 'Под этот фильтр эскалаций нет.'} /> : <><div className="pr-escalation-list">{query.data.items.map(item => <EscalationItem key={item.id} item={item} selected={filters.selected === item.id} />)}</div><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
