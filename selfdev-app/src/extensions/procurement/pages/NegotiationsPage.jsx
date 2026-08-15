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
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Activity, MessageSquare } from '../components/icons'

export default function NegotiationsPage() {
  const navigate = useNavigate()
  const { canManageNegotiations } = useProcurementPermissions()
  const [filters, setFilters] = useUrlFilters({ page: '1', pageSize: '20' })
  const query = useQuery({ queryKey: procurementKeys.negotiations(filters), queryFn: ({ signal }) => procurementApi.negotiations(filters, signal), keepPreviousData: true })
  return <div className="pr-stack"><div className="pr-section-heading"><div><h2>Переговоры</h2><p>Задания, очередь отправки, состояние диалогов и ожидаемые действия.</p></div><div className="pr-inline-actions"><RouterLinkButton to="/procurement/negotiations/agent" variant="outline" size="sm"><Activity size={15} />Что делает агент</RouterLinkButton>{canManageNegotiations && <RouterLinkButton to="/procurement/negotiations/new"><MessageSquare />Создать задание</RouterLinkButton>}</div></div><ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'READY', label: 'Готово к постановке' }, { value: 'QUEUED', label: 'В очереди' }, { value: 'ACTIVE', label: 'Отправляется' }, { value: 'WAITING_SUPPLIER', label: 'Ждём поставщика' }, { value: 'FOLLOW_UP_DUE', label: 'Нужен follow-up' }, { value: 'ESCALATED', label: 'Эскалация' }, { value: 'COMPLETE', label: 'Завершено' }, { value: 'STALE', label: 'Устарело' }]} placeholder="Поставщик, контакт, карточка или NEG-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.data.items} onRowClick={row => navigate(`/procurement/negotiations/${row.id}`)} emptyTitle="Переговоров пока нет" columns={[
      { id: 'supplierName', header: 'Поставщик', cell: row => <div className="pr-primary-cell"><strong>{row.supplierName}</strong><CopyableId value={row.id} /><span>{row.contactName || row.contactId} · {row.channel}</span></div> },
      { id: 'cardTitle', header: 'Карточка', cell: row => <div className="pr-primary-cell"><strong>{row.cardTitle}</strong><span>#{row.cardId}</span></div> },
      { id: 'status', header: 'Состояние', cell: row => <StatusBadge status={row.status} /> },
      { id: 'nextAction', header: 'Следующее действие', cell: row => row.nextAction === 'FOLLOW_UP' ? 'Уточняющий запрос' : row.nextAction === 'SEND_INITIAL_RFQ' ? 'Отправить RFQ' : '—' },
      { id: 'nextActionAt', header: 'Запланировано', cell: row => row.nextActionAt ? new Date(row.nextActionAt).toLocaleString('ru-RU') : '—' },
      { id: 'lastDispatchStatus', header: 'Доставка', cell: row => <StatusBadge status={row.lastDispatchStatus || 'UNKNOWN'} /> },
      { id: 'updatedAt', header: 'Обновлено', cell: row => row.updatedAt ? new Date(row.updatedAt).toLocaleString('ru-RU') : '—' },
    ]} /><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}
