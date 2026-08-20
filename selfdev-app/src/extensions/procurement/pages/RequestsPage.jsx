import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { DataTable, InfiniteListFooter } from '../components/DataTable'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { ArrowDown, ArrowUp } from '../components/icons'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'

const statuses = [
  { value: 'DRAFT', label: 'Черновики' },
  { value: 'SOURCING', label: 'Поиск' }, { value: 'NEGOTIATION', label: 'Переговоры' },
  { value: 'WAITING_SUPPLIER', label: 'Ждём поставщика' }, { value: 'COMPARISON', label: 'Сравнение' },
  { value: 'NEEDS_HUMAN_REVIEW', label: 'Нужен специалист' },
]

export default function RequestsPage() {
  const navigate = useNavigate()
  const { canWriteCards } = useProcurementPermissions()
  const [filters, setFilters] = useUrlFilters({ pageSize: '20', order: 'desc' })
  const ascending = filters.order === 'asc'
  const query = useInfiniteList({
    queryKey: procurementKeys.cards(filters),
    fetchPage: (page, signal) => procurementApi.cards({ ...filters, page }, signal),
  })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Карточки закупок</h2><p>Запрос, нормализация вещества, RFQ и ход закупки в одном реестре.</p></div>{canWriteCards && <div className="pr-inline-actions"><RouterLinkButton to="/procurement/requests/import" variant="outline">Импорт из файла</RouterLinkButton><RouterLinkButton to="/procurement/requests/new">Создать карточку</RouterLinkButton></div>}</div><ListFilters filters={filters} onChange={setFilters} statuses={statuses} placeholder="CAS, вещество или номер карточки">
      <Button variant="outline" size="sm" onClick={() => setFilters({ order: ascending ? 'desc' : 'asc' })} aria-label={`Сортировка по номеру карточки: ${ascending ? 'по возрастанию' : 'по убыванию'}. Переключить.`}>{ascending ? <ArrowUp size={15} /> : <ArrowDown size={15} />}№ {ascending ? 'по возрастанию' : 'по убыванию'}</Button>
    </ListFilters>
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.items} onRowClick={row => navigate(`/procurement/requests/${row.id}`)} emptyTitle="Карточек нет" emptyDescription={canWriteCards ? 'Создайте первую карточку или сформулируйте запрос Procurement Agent.' : 'Создать карточку можно через Procurement Agent.'} columns={[
      { id: 'title', header: 'Закупка', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><div className="pr-primary-meta"><CopyableId value={row.id} displayValue={`#${row.id}`} /><span>· CAS {row.casNumber || 'не указан'}</span></div></div> },
      { id: 'targetVolume', header: 'Объём', cell: row => row.targetVolume || (row.isDraft ? <em className="pr-import-missing">не заполнен</em> : '—') },
      { id: 'stage', header: 'Этап', cell: row => row.isDraft ? <StatusBadge status="DRAFT" label={`Черновик · не хватает ${row.incompleteFields?.length ?? 0}`} /> : <StatusBadge status={row.stage} /> },
      { id: 'completeness', header: 'Качество данных', cell: row => <StatusBadge status={row.completeness || row.normalizationStatus} /> },
      { id: 'relations', header: 'Связи', cell: row => <span>{row.supplierCount ?? '—'} пост. · {row.proposalCount ?? '—'} предл.</span> },
      { id: 'updatedAt', header: 'Обновлено', cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleString('ru-RU') : '—' },
    ]} /><InfiniteListFooter sentinelRef={query.sentinelRef} loaded={query.items.length} total={query.total} hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} onLoadMore={() => query.fetchNextPage()} /></>}
  </div>
}
