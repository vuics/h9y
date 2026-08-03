import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { DataTable, Pagination } from '../components/DataTable'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'

const statuses = [
  { value: 'SOURCING', label: 'Поиск' }, { value: 'NEGOTIATION', label: 'Переговоры' },
  { value: 'WAITING_SUPPLIER', label: 'Ждём поставщика' }, { value: 'COMPARISON', label: 'Сравнение' },
  { value: 'NEEDS_HUMAN_REVIEW', label: 'Нужен специалист' },
]

export default function RequestsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const query = useQuery({ queryKey: procurementKeys.cards(filters), queryFn: ({ signal }) => procurementApi.cards(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Карточки закупок</h2><p>Запрос, нормализация вещества, RFQ и ход закупки в одном реестре.</p></div></div><ListFilters filters={filters} onChange={setFilters} statuses={statuses} placeholder="CAS, вещество или номер карточки" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.data.items} onRowClick={row => navigate(`/procurement/requests/${row.id}`)} emptyTitle="Карточек нет" emptyDescription="Создать карточку можно через Procurement Agent." columns={[
      { id: 'title', header: 'Закупка', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><span>#{row.id} · CAS {row.casNumber || 'не указан'}</span></div> },
      { id: 'targetVolume', header: 'Объём' },
      { id: 'stage', header: 'Этап', cell: row => <StatusBadge status={row.stage} /> },
      { id: 'completeness', header: 'Качество данных', cell: row => <StatusBadge status={row.completeness || row.normalizationStatus} /> },
      { id: 'relations', header: 'Связи', cell: row => <span>{row.supplierCount ?? '—'} пост. · {row.proposalCount ?? '—'} предл.</span> },
      { id: 'updatedAt', header: 'Обновлено', cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleString('ru-RU') : '—' },
    ]} /><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
