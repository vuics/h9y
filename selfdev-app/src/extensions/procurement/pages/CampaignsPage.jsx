import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { PurchaseStart } from '../components/PurchaseStart'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { purchaseSentence, purchaseSize } from '../lib/purchases'
import { Button } from '@/components/ui/button'
import { ChevronRight } from '../components/icons'

const REACH = {
  SOURCING: 'только поиск',
  CONTACTS: 'поиск и контакты',
  OUTREACH: 'до рассылки запросов',
  NEGOTIATION: 'до сравнимых предложений',
}

/** One purchase as a line: what it is, how far it got, what it is doing. */
function PurchaseRow({ row }) {
  const sentence = purchaseSentence(row)
  const size = purchaseSize(row)
  const total = row.progress?.total || 0
  const percent = total ? Math.round((row.progress?.settled || 0) / total * 100) : 0
  const cas = row.substance?.casNumber
  return <Link to={`/procurement/campaigns/${row.campaignId}`} className="pr-purchase" data-status={row.status}>
    <div className="pr-purchase__name">
      <strong>{row.title}</strong>
      <span>{[cas && `CAS ${cas}`, size, REACH[row.reach], row.createdAt && new Date(row.createdAt).toLocaleDateString('ru-RU')].filter(Boolean).join(' · ')}</span>
    </div>
    {total > 1
      ? <div className="pr-campaign-row-progress" title={`${percent}%`}>
        <span>{row.progress.settled} из {total}</span>
        <div className="pr-campaign-row-progress__track" role="img" aria-label={`Пройдено ${percent}%`}>
          <span data-status={row.status} style={{ width: `${percent}%` }} />
        </div>
      </div>
      : <div />}
    <div className={`pr-purchase__state pr-purchase__state--${sentence.tone}`}><i aria-hidden="true" />{sentence.text}</div>
    <ChevronRight size={16} className="pr-purchase__open" />
  </Link>
}

export default function CampaignsPage() {
  const { canWriteCards } = useProcurementPermissions()
  const [showStopped, setShowStopped] = useState(false)
  const query = useQuery({
    queryKey: procurementKeys.campaigns(),
    queryFn: ({ signal }) => procurementApi.campaigns(signal),
    // One poll covers every running campaign in the list; the detail page
    // polls only the one that is open.
    refetchInterval: data => (data?.items || []).some(item => item.status === 'RUNNING') ? 5000 : false,
  })

  const all = query.data?.items || []
  // A stopped campaign is history, not work: with the duplicates of one list
  // stopped, the list is back to the campaigns someone is acting on.
  const stoppedCount = all.filter(item => item.status === 'CANCELLED').length
  const items = showStopped ? all : all.filter(item => item.status !== 'CANCELLED')

  return <div className="pr-stack pr-stack--lg">
    <PurchaseStart canWrite={canWriteCards} />
    <section className="pr-stack">
      <h2>Ваши закупки</h2>
      {query.isLoading
        ? <LoadingState />
        : query.isError && !query.data
          ? <ErrorState error={query.error} onRetry={query.refetch} />
          : items.length
            ? <div className="pr-purchase-list">{items.map(row => <PurchaseRow key={row.campaignId} row={row} />)}</div>
            : <EmptyState title="Закупок ещё не было" description="Введите вещество или список выше — поиск, контакты и рассылка пойдут сами, а решения соберутся во вкладке «Эскалации»." />}
      {stoppedCount > 0 && <div className="pr-inline-actions">
        <Button variant="ghost" size="sm" onPress={() => setShowStopped(value => !value)}>
          {showStopped ? 'Скрыть остановленные' : `Показать остановленные (${stoppedCount})`}
        </Button>
      </div>}
    </section>
  </div>
}
