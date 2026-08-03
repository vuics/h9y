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
import { CopyableId } from '../components/CopyableId'

export default function NegotiationsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const query = useQuery({ queryKey: procurementKeys.negotiations(filters), queryFn: ({ signal }) => procurementApi.negotiations(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Переговоры</h2><p>Каналы, состояние диалогов и ожидаемые действия без внутренних деталей агента.</p></div></div><ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'WAITING_SUPPLIER', label: 'Ждём поставщика' }, { value: 'IN_PROGRESS', label: 'В работе' }, { value: 'ESCALATED', label: 'Эскалация' }, { value: 'FAILED', label: 'Ошибка' }, { value: 'COMPLETE', label: 'Завершено' }]} placeholder="Поставщик, контакт, карточка или NEG-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.data.items} onRowClick={row => navigate(`/procurement/negotiations/${row.id}`)} emptyTitle="Переговоров пока нет" columns={[
      { id: 'supplierName', header: 'Поставщик', cell: row => <div className="pr-primary-cell"><strong>{row.supplierName}</strong><CopyableId value={row.id} /><span>{row.contactName || row.contactId} · {row.channel}</span></div> },
      { id: 'cardTitle', header: 'Карточка', cell: row => <div className="pr-primary-cell"><strong>{row.cardTitle}</strong><span>#{row.cardId}</span></div> },
      { id: 'status', header: 'Состояние', cell: row => <StatusBadge status={row.status} /> },
      { id: 'nextAction', header: 'Следующее действие', cell: row => row.nextAction === 'FOLLOW_UP' ? 'Уточняющий запрос' : row.nextAction === 'SEND_INITIAL_RFQ' ? 'Отправить RFQ' : '—' },
      { id: 'lastDispatchStatus', header: 'Доставка', cell: row => <StatusBadge status={row.lastDispatchStatus || 'UNKNOWN'} /> },
      { id: 'updatedAt', header: 'Обновлено', cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleString('ru-RU') : '—' },
    ]} /><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
