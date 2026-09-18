import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DataTable } from '../components/DataTable'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { CopyableId } from '../components/CopyableId'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { Button } from '@/components/ui/button'

const REACH = {
  SOURCING: 'только поиск',
  CONTACTS: 'поиск и контакты',
  OUTREACH: 'до рассылки запросов',
  NEGOTIATION: 'до сравнимых предложений',
}

export default function CampaignsPage() {
  const navigate = useNavigate()
  const [showStopped, setShowStopped] = useState(false)
  const query = useQuery({
    queryKey: procurementKeys.campaigns(),
    queryFn: ({ signal }) => procurementApi.campaigns(signal),
    // One poll covers every running campaign in the list; the detail page
    // polls only the one that is open.
    refetchInterval: data => (data?.items || []).some(item => item.status === 'RUNNING') ? 5000 : false,
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const all = query.data?.items || []
  // A stopped campaign is history, not work: with the duplicates of one list
  // stopped, the list is back to the campaigns someone is acting on.
  const stoppedCount = all.filter(item => item.status === 'CANCELLED').length
  const items = showStopped ? all : all.filter(item => item.status !== 'CANCELLED')

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
      rowKey="campaignId"
      onRowClick={row => navigate(`/procurement/campaigns/${row.campaignId}`)}
      emptyTitle="Кампаний ещё не было"
      emptyDescription="Загрузите список веществ файлом или отметьте карточки в реестре и запустите поиск по всем сразу."
      columns={[
        { id: 'title', header: 'Кампания', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><div className="pr-primary-meta"><CopyableId value={row.campaignId} /><span>· {REACH[row.reach] || row.reach}</span></div></div> },
        { id: 'status', header: 'Состояние', cell: row => <CampaignStatusBadge status={row.status} /> },
        { id: 'progress', header: 'Пройдено', cell: row => `${row.progress.settled} из ${row.progress.total}` },
        { id: 'awaiting', header: 'Ждут решения', cell: row => row.progress.awaitingReview || '—' },
        { id: 'candidates', header: 'Кандидатов', cell: row => row.progress.candidateTotal || '—' },
        { id: 'requests', header: 'Запросов', cell: row => row.progress.requestTotal ? `${row.progress.requestTotal}${row.progress.responseTotal ? ` · ${row.progress.responseTotal} отв.` : ''}` : '—' },
        { id: 'createdAt', header: 'Запущена', cell: row => row.createdAt ? new Date(row.createdAt).toLocaleString('ru-RU') : '—' },
      ]}
    />
    {stoppedCount > 0 && <div className="pr-inline-actions">
      <Button variant="ghost" size="sm" onPress={() => setShowStopped(value => !value)}>
        {showStopped ? 'Скрыть остановленные' : `Показать остановленные (${stoppedCount})`}
      </Button>
    </div>}
  </div>
}
