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

export default function SuppliersPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const query = useQuery({ queryKey: procurementKeys.suppliers(filters), queryFn: ({ signal }) => procurementApi.suppliers(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Поставщики и контакты</h2><p>Квалификация, источники подтверждения, вещества и история коммуникаций.</p></div></div><ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'UNVERIFIED', label: 'Не проверен' }, { value: 'UNDER_REVIEW', label: 'На проверке' }, { value: 'QUALIFIED', label: 'Квалифицирован' }, { value: 'REJECTED', label: 'Отклонён' }]} placeholder="Компания, страна, контакт или SUP-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.data.items} onRowClick={row => navigate(`/procurement/suppliers/${row.id}`)} emptyTitle="Поставщиков пока нет" columns={[
      { id: 'name', header: 'Поставщик', cell: row => <div className="pr-primary-cell"><strong>{row.name}</strong><CopyableId value={row.id} /></div> },
      { id: 'country', header: 'Страна', cell: row => row.country || 'Не указана' },
      { id: 'qualificationStatus', header: 'Квалификация', cell: row => <StatusBadge status={row.qualificationStatus} /> },
      { id: 'capabilities', header: 'Предлагаемые вещества', cell: row => <div className="pr-inline-list">{row.capabilities.slice(0, 2).map(item => <span key={`${item.casNumber}-${item.source}`}>{item.casNumber} · <StatusBadge status={item.verificationStatus} compact /></span>)}</div> },
      { id: 'contacts', header: 'Контакты', cell: row => `${row.contacts.filter(item => item.active).length} активн.` },
      { id: 'updatedAt', header: 'Обновлено', cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('ru-RU') : '—' },
    ]} /><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
