import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DataTable } from '../components/DataTable'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { CopyableId } from '../components/CopyableId'
import { Badge } from '@/components/ui/badge'
import { RouterLinkButton } from '../../../components/RouterLinkButton'

const STATUS = {
  RUNNING: 'Идёт',
  AWAITING_REVIEW: 'Ждёт согласования',
  COMPLETED: 'Завершена',
  FAILED: 'Не выполнена',
  CANCELLED: 'Остановлена',
  INTERRUPTED: 'Прервана перезапуском',
}

const REACH = {
  SOURCING: 'только поиск',
  CONTACTS: 'поиск и контакты',
  OUTREACH: 'до рассылки запросов',
  NEGOTIATION: 'до сравнимых предложений',
}

export default function CampaignsPage() {
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: procurementKeys.campaigns(),
    queryFn: ({ signal }) => procurementApi.campaigns(signal),
    // One poll covers every running campaign in the list; the detail page
    // polls only the one that is open.
    refetchInterval: data => (data?.items || []).some(item => item.status === 'RUNNING') ? 5000 : false,
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const items = query.data?.items || []

  return <div className="pr-stack">
    <div className="pr-section-heading"><div>
      <h2>Кампании</h2>
      <p>Один запуск по списку веществ: поиск, контакты и рассылка идут сами, а решения собираются в одном месте.</p>
    </div><div className="pr-inline-actions">
      <RouterLinkButton to="/procurement/requests/import" variant="outline">Загрузить список</RouterLinkButton>
      <RouterLinkButton to="/procurement/requests">Выбрать карточки</RouterLinkButton>
    </div></div>
    <DataTable
      rows={items}
      onRowClick={row => navigate(`/procurement/campaigns/${row.campaignId}`)}
      emptyTitle="Кампаний ещё не было"
      emptyDescription="Загрузите список веществ файлом или отметьте карточки в реестре и запустите поиск по всем сразу."
      columns={[
        { id: 'title', header: 'Кампания', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><div className="pr-primary-meta"><CopyableId value={row.campaignId} /><span>· {REACH[row.reach] || row.reach}</span></div></div> },
        { id: 'status', header: 'Состояние', cell: row => <Badge variant={row.status === 'AWAITING_REVIEW' ? 'secondary' : 'outline'}>{STATUS[row.status] || row.status}</Badge> },
        { id: 'progress', header: 'Пройдено', cell: row => `${row.progress.settled} из ${row.progress.total}` },
        { id: 'awaiting', header: 'Ждут решения', cell: row => row.progress.awaitingReview || '—' },
        { id: 'candidates', header: 'Кандидатов', cell: row => row.progress.candidateTotal || '—' },
        { id: 'createdAt', header: 'Запущена', cell: row => row.createdAt ? new Date(row.createdAt).toLocaleString('ru-RU') : '—' },
      ]}
    />
  </div>
}
