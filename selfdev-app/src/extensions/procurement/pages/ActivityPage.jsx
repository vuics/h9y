import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { AlertTriangle, Check, CircleAlert, Clock } from '../components/icons'
import { CopyableId } from '../components/CopyableId'

const icons = { error: CircleAlert, warning: AlertTriangle, success: Check, info: Clock }
const entityPaths = { card: 'requests', negotiation: 'negotiations', proposal: 'proposals', escalation: 'escalations' }
const entityIdLabels = { card: 'CARD-ID', negotiation: 'NEG-ID', proposal: 'RESP-ID', escalation: 'ESC-ID' }

export default function ActivityPage() {
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '30' })
  const [expanded, setExpanded] = useState(null)
  const query = useQuery({ queryKey: procurementKeys.activity(filters), queryFn: ({ signal }) => procurementApi.activity(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Активность и ошибки</h2><p>Понятный журнал интеграций, обработки сообщений, вложений и workflow.</p></div></div><ListFilters filters={filters} onChange={setFilters} statuses={[]} placeholder="Событие, NEG-ID, RESP-ID, ESC-ID или описание" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !query.data.items.length ? <EmptyState title="Событий нет" /> : <div className="pr-event-list">{query.data.items.map(item => { const EventIcon = icons[item.level] || Clock; const path = entityPaths[item.entityType]; const relatedId = item.entityId || item.id; const relatedIdLabel = item.entityId ? entityIdLabels[item.entityType] || 'ENTITY-ID' : 'EVENT-ID'; return <article className={`pr-event pr-event--${item.level}`} key={item.id}><div className="pr-event__icon"><EventIcon /></div><div className="pr-event__body"><header><div><strong>{item.title}</strong><div className="pr-event__meta"><span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span><span>·</span><span>{relatedIdLabel}</span><CopyableId value={relatedId} /></div></div>{item.retryStatus && <StatusBadge status={item.retryStatus} />}</header><p>{item.description}</p>{path && item.entityId && <Link to={`/procurement/${path}/${item.entityId}`}>Открыть связанную сущность</Link>}{item.diagnostic && <div><button className="pr-disclosure" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? 'Скрыть' : 'Технические сведения'}</button>{expanded === item.id && <pre className="pr-diagnostic">{item.diagnostic}</pre>}</div>}</div></article>})}</div>}
  </div>
}
