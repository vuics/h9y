import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { Pagination } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { AlertTriangle } from '../components/icons'
import { Card, CardContent } from '@/components/ui/card'
import { CopyableId } from '../components/CopyableId'

export default function EscalationsPage() {
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const query = useQuery({ queryKey: procurementKeys.escalations(filters), queryFn: ({ signal }) => procurementApi.escalations(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Очередь внимания</h2><p>Решения, которые агент не вправе принимать без специалиста.</p></div></div><ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'OPEN', label: 'Открыта' }, { value: 'IN_REVIEW', label: 'На рассмотрении' }, { value: 'RECOMMENDED', label: 'Есть рекомендация' }, { value: 'RESOLVED', label: 'Решена' }]} placeholder="Причина, ответственный или ESC-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !query.data.items.length ? <EmptyState title="Очередь пуста" description="Открытых эскалаций и ручных проверок нет." /> : <><div className="pr-escalation-list">{query.data.items.map(item => <Card key={item.id} className={filters.selected === item.id ? 'pr-escalation pr-escalation--selected' : 'pr-escalation'}><CardContent><div className="pr-priority"><AlertTriangle size={16} /><strong>{item.priority}</strong><span>приоритет</span></div><div className="pr-escalation__body"><div className="pr-escalation__heading"><div><CopyableId value={item.id} /><h3><Link to={`/procurement/escalations/${item.id}`}>{item.title}</Link></h3></div><StatusBadge status={item.status} /></div><p>{item.recommendation}</p><div className="pr-escalation__relations"><Link to={`/procurement/requests/${item.cardId}`}>{item.cardTitle}</Link><span>·</span><Link to={`/procurement/suppliers/${item.supplierId}`}>{item.supplierName}</Link></div><div className="pr-risk-list">{item.risks.map(risk => <div key={risk.code}><strong>{risk.reason}</strong>{risk.evidence?.length > 0 && <blockquote>{risk.evidence[0]}</blockquote>}</div>)}</div><footer><span>Создано {new Date(item.createdAt).toLocaleString('ru-RU')}</span><span>Ответственный: {item.assignedTo || 'не назначен'}</span></footer></div></CardContent></Card>)}</div><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
