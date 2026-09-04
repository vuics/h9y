import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { useInfiniteList } from '../hooks/useInfiniteList'
import { DataTable, InfiniteListFooter } from '../components/DataTable'
import { CampaignLaunchPanel } from '../components/CampaignLaunchPanel'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { ArrowDown, ArrowUp, Search } from '../components/icons'
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
  const { canWriteCards, canResearchSourcing } = useProcurementPermissions()
  const [filters, setFilters] = useUrlFilters({ pageSize: '20', order: 'desc' })
  // Selection mode is entered explicitly rather than always on: a checkbox in
  // front of every row on a screen most people open to read turns a register
  // into a form, and the batch launch is not the common case for one card.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [launching, setLaunching] = useState(false)
  const ascending = filters.order === 'asc'
  const query = useInfiniteList({
    queryKey: procurementKeys.cards(filters),
    fetchPage: (page, signal) => procurementApi.cards({ ...filters, page }, signal),
  })

  // Selection follows the cards actually loaded: a row filtered away is no
  // longer on screen, and launching a search on a substance the operator can
  // no longer see is the batch failure mode worth ruling out.
  const visibleIds = useMemo(() => query.items.map(row => row.id), [query.items])
  const selected = useMemo(
    () => selectedIds.filter(id => visibleIds.includes(id)),
    [selectedIds, visibleIds],
  )
  const allSelected = visibleIds.length > 0 && selected.length === visibleIds.length

  const leaveSelection = () => { setSelecting(false); setSelectedIds([]); setLaunching(false) }
  const toggle = (id, checked) => setSelectedIds(current => checked
    ? [...new Set([...current, id])]
    : current.filter(value => value !== id))

  const selectionColumn = {
    id: 'select',
    className: 'pr-table__select',
    header: <label aria-label={allSelected ? 'Снять выбор со всех' : 'Выбрать все загруженные'}><input
      type="checkbox"
      checked={allSelected}
      onChange={event => setSelectedIds(event.target.checked ? visibleIds : [])}
    /></label>,
    cell: row => <label aria-label={`Выбрать карточку №${row.id}`}><input
      type="checkbox"
      checked={selected.includes(row.id)}
      onChange={event => toggle(row.id, event.target.checked)}
    /></label>,
  }

  const columns = [
    { id: 'title', header: 'Закупка', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><div className="pr-primary-meta"><CopyableId value={row.id} displayValue={`#${row.id}`} /><span>· CAS {row.casNumber || 'не указан'}</span></div></div> },
    { id: 'targetVolume', header: 'Объём', cell: row => row.targetVolume || (row.isDraft ? <em className="pr-import-missing">не заполнен</em> : '—') },
    { id: 'stage', header: 'Этап', cell: row => row.isDraft ? <StatusBadge status="DRAFT" label={`Черновик · не хватает ${row.incompleteFields?.length ?? 0}`} /> : <StatusBadge status={row.stage} /> },
    { id: 'completeness', header: 'Качество данных', cell: row => <StatusBadge status={row.completeness || row.normalizationStatus} /> },
    { id: 'relations', header: 'Связи', cell: row => <span>{row.supplierCount ?? '—'} пост. · {row.proposalCount ?? '—'} предл.</span> },
    { id: 'updatedAt', header: 'Обновлено', cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleString('ru-RU') : '—' },
  ]

  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Карточки закупок</h2><p>Запрос, нормализация вещества, RFQ и ход закупки в одном реестре.</p></div>{canWriteCards && <div className="pr-inline-actions">
    {canResearchSourcing && (selecting
      ? <Button variant="outline" onPress={leaveSelection}>Отменить выбор</Button>
      : <Button variant="outline" onPress={() => setSelecting(true)}><Search size={15} />Выбрать карточки</Button>)}
    <RouterLinkButton to="/procurement/requests/import" variant="outline">Импорт из файла</RouterLinkButton>
    <RouterLinkButton to="/procurement/requests/new">Создать карточку</RouterLinkButton>
  </div>}</div>

    {selecting && <div className="pr-selection-bar" role="status">
      <span>{selected.length ? `Выбрано ${selected.length} из ${visibleIds.length} загруженных` : 'Отметьте вещества, по которым запустить поиск'}</span>
      <div className="pr-inline-actions">
        <Button variant="outline" size="sm" isDisabled={!selected.length} onPress={() => setSelectedIds([])}>Снять выбор</Button>
        <Button size="sm" isDisabled={!selected.length || launching} onPress={() => setLaunching(true)}><Search size={15} />Запустить поиск</Button>
      </div>
    </div>}

    {selecting && launching && selected.length > 0 && <CampaignLaunchPanel
      cardIds={selected}
      canEdit={canResearchSourcing}
      onCancel={() => setLaunching(false)}
    />}

    <ListFilters filters={filters} onChange={setFilters} statuses={statuses} placeholder="CAS, вещество или номер карточки">
      <Button variant="outline" size="sm" onClick={() => setFilters({ order: ascending ? 'desc' : 'asc' })} aria-label={`Сортировка по номеру карточки: ${ascending ? 'по возрастанию' : 'по убыванию'}. Переключить.`}>{ascending ? <ArrowUp size={15} /> : <ArrowDown size={15} />}№ {ascending ? 'по возрастанию' : 'по убыванию'}</Button>
    </ListFilters>

    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <>
      <DataTable
        rows={query.items}
        onRowClick={row => navigate(`/procurement/requests/${row.id}`)}
        emptyTitle="Карточек нет"
        emptyDescription={canWriteCards ? 'Создайте первую карточку или сформулируйте запрос Procurement Agent.' : 'Создать карточку можно через Procurement Agent.'}
        columns={selecting ? [selectionColumn, ...columns] : columns}
      />
      <InfiniteListFooter sentinelRef={query.sentinelRef} loaded={query.items.length} total={query.total} hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} onLoadMore={() => query.fetchNextPage()} />
    </>}
  </div>
}
