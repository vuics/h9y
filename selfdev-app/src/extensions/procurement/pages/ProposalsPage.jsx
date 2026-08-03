import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { DataTable, Pagination } from '../components/DataTable'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { StatusBadge } from '../components/StatusBadge'

export default function ProposalsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const query = useQuery({ queryKey: procurementKeys.proposals(filters), queryFn: ({ signal }) => procurementApi.proposals(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Предложения</h2><p>Нормализованные коммерческие условия с исходными значениями и признаками качества.</p></div>{filters.cardId && <RouterLinkButton to={`/procurement/proposals/compare?cardId=${filters.cardId}`}>Сравнить предложения</RouterLinkButton>}</div><ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'COMPLETE', label: 'Готово' }, { value: 'NEEDS_CLARIFICATION', label: 'Нужно уточнение' }, { value: 'CONFLICTING', label: 'Противоречия' }, { value: 'NEEDS_HUMAN_REVIEW', label: 'Нужен специалист' }]} placeholder="Поставщик, валюта, Incoterm или RESP-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.data.items} onRowClick={row => navigate(`/procurement/proposals/${row.id}`)} emptyTitle="Предложений пока нет" columns={[
      { id: 'supplierName', header: 'Поставщик', cell: row => <div className="pr-primary-cell"><strong>{row.supplierName}</strong><span>{row.id} · рев. {row.revision}</span></div> },
      { id: 'price', header: 'Цена', cell: row => row.price ? <strong>{row.price} {row.currency}/{row.priceUnit}</strong> : <StatusBadge status="UNKNOWN" /> },
      { id: 'basis', header: 'Базис', cell: row => row.incoterm ? `${row.incoterm} ${row.namedPlace || ''}` : <StatusBadge status="UNKNOWN" /> },
      { id: 'quantity', header: 'Количество / MOQ', cell: row => <span>{row.quantity || '—'} / {row.moq || '—'}</span> },
      { id: 'documents', header: 'Документы', cell: row => <div className="pr-doc-status"><span>CoA <StatusBadge status={row.coa} compact /></span><span>TDS <StatusBadge status={row.tds} compact /></span></div> },
      { id: 'completeness', header: 'Готовность', cell: row => <StatusBadge status={row.completeness} /> },
    ]} /><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
