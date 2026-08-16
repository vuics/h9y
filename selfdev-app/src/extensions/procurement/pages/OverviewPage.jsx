import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { AlertTriangle, Clock, FileCheck, Flask, Inbox } from '../components/icons'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { StageBoard } from '../components/StageBoard'
import { Sparkline } from '../components/Sparkline'

const kpis = [
  ['activeCards', 'Активные карточки', Flask, 'progress'],
  ['waitingSupplier', 'Ждём поставщика', Clock, 'waiting'],
  ['needsSpecialist', 'Нужен специалист', AlertTriangle, 'warning'],
  ['readyProposals', 'Готовые предложения', FileCheck, 'complete'],
  ['failures', 'Ошибки обработки', Inbox, 'danger'],
]

const TREND_DAYS = 14

export default function OverviewPage() {
  const query = useQuery({ queryKey: procurementKeys.overview(), queryFn: ({ signal }) => procurementApi.overview({ signal }), staleTime: 30000, retry: 1 })
  // Its own query, deliberately not blocking the page: the tiles are useful
  // without a trend, and a slow series must never hold up the worklist.
  const trends = useQuery({
    queryKey: procurementKeys.analyticsTrends(TREND_DAYS),
    queryFn: ({ signal }) => procurementApi.analyticsTrends({ days: TREND_DAYS }, signal),
    staleTime: 60000,
    retry: 1,
  })
  if (query.isLoading) return <LoadingState rows={8} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const data = query.data
  if (!data) return <EmptyState />
  return <div className="pr-stack pr-stack--lg">
    <section className="pr-kpis" aria-label="Ключевые показатели">{kpis.map(([key, label, KpiIcon, tone]) => {
      const series = trends.data?.series?.[key]
      return <Card key={key} className="pr-kpi"><CardContent><div className={`pr-kpi__icon pr-kpi__icon--${tone}`}><KpiIcon /></div><div className="pr-kpi__body"><strong>{data.kpis?.[key] ?? '—'}</strong><span>{label}</span>{series && <>
        <Sparkline points={series.points} label={series.label} kind={series.kind} tone={tone} />
        <small>{series.label}</small>
      </>}</div></CardContent></Card>
    })}</section>
    {/* Said once under the row rather than repeated on four tiles: one fact
        multiplied by four is noise, which is the mistake the benchmark card
        already taught. */}
    {trends.data?.note && <p className="pr-kpis__note">{trends.data.note}</p>}
    <section><div className="pr-section-heading"><div><h2>Активные закупки по этапам</h2><p>Счётчик каждой колонки — точное число карточек на этапе, а не размер первой страницы.</p></div><Link to="/procurement/requests">Все карточки</Link></div>
      <StageBoard stages={data.stages} truncated={data.truncated} />
    </section>
    <div className="pr-overview-grid"><Card><CardHeader><CardTitle>Требует внимания</CardTitle><CardAction><Link to="/procurement/escalations">Вся очередь</Link></CardAction></CardHeader><CardContent className="pr-attention-list">{data.attention?.length ? data.attention.slice(0, 4).map(item => <Link to={`/procurement/escalations?selected=${item.id}`} key={item.id} className="pr-attention"><div className="pr-attention__priority">{item.priority}</div><div><strong>{item.title}</strong><span>{item.cardTitle} · {item.supplierName}</span></div><StatusBadge status={item.status} compact /></Link>) : <EmptyState title="Очередь пуста" description="Открытых эскалаций нет." />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Последние изменения</CardTitle><CardAction><Link to="/procurement/activity">Журнал</Link></CardAction></CardHeader><CardContent className="pr-activity-list">{data.recentActivity?.map(item => <div className="pr-activity" key={item.id}><div className={`pr-activity__dot pr-activity__dot--${item.level}`} /><div><strong>{item.title}</strong><p>{item.description}</p><time>{new Date(item.createdAt).toLocaleString('ru-RU')}</time></div></div>)}</CardContent></Card></div>
    {data.kpis?.failures > 0 && <Alert><AlertTriangle /><AlertTitle>Есть необработанные сбои</AlertTitle><AlertDescription><p>Ошибки интеграций и вложений показаны отдельно от бизнес-статусов и не скрываются автоматическими повторами.</p><Link to="/procurement/activity?level=error">Открыть ошибки</Link></AlertDescription></Alert>}
  </div>
}
