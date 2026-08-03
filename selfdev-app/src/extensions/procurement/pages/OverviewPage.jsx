import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { AlertTriangle, Clock, FileCheck, Flask, Inbox } from '../components/icons'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'

const kpis = [
  ['activeCards', 'Активные карточки', Flask, 'progress'],
  ['waitingSupplier', 'Ждём поставщика', Clock, 'waiting'],
  ['needsSpecialist', 'Нужен специалист', AlertTriangle, 'warning'],
  ['readyProposals', 'Готовые предложения', FileCheck, 'complete'],
  ['failures', 'Ошибки обработки', Inbox, 'danger'],
]

export default function OverviewPage() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: procurementKeys.overview(), queryFn: ({ signal }) => procurementApi.overview({ signal }), staleTime: 30000, retry: 1 })
  if (query.isLoading) return <LoadingState rows={8} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const data = query.data
  if (!data) return <EmptyState />
  return <div className="pr-stack pr-stack--lg">
    <section className="pr-kpis" aria-label="Ключевые показатели">{kpis.map(([key, label, KpiIcon, tone]) => <Card key={key} className="pr-kpi"><CardContent><div className={`pr-kpi__icon pr-kpi__icon--${tone}`}><KpiIcon /></div><div><strong>{data.kpis?.[key] ?? '—'}</strong><span>{label}</span></div></CardContent></Card>)}</section>
    <section><div className="pr-section-heading"><div><h2>Активные закупки по этапам</h2><p>Карточки сгруппированы по фактическому состоянию процесса.</p></div><Link to="/procurement/requests">Все карточки</Link></div>
      <div className="pr-stage-board">{(data.stages || []).map(stage => <div className="pr-stage" key={stage.id}><div className="pr-stage__header"><span>{stage.label}</span><Badge variant="secondary">{stage.count}</Badge></div><div className="pr-stage__cards">{stage.cards?.map(card => <button key={card.id} onClick={() => navigate(`/procurement/requests/${card.id}`)} className="pr-case-card"><div><strong>{card.title}</strong><span>CAS {card.casNumber || 'не указан'} · {card.targetVolume || 'объём не указан'}</span></div><StatusBadge status={card.completeness || card.stage} compact /></button>)}{!stage.cards?.length && <div className="pr-stage__empty">Нет карточек</div>}</div></div>)}</div>
    </section>
    <div className="pr-overview-grid"><Card><CardHeader><CardTitle>Требует внимания</CardTitle><CardAction><Link to="/procurement/escalations">Вся очередь</Link></CardAction></CardHeader><CardContent className="pr-attention-list">{data.attention?.length ? data.attention.slice(0, 4).map(item => <Link to={`/procurement/escalations?selected=${item.id}`} key={item.id} className="pr-attention"><div className="pr-attention__priority">{item.priority}</div><div><strong>{item.title}</strong><span>{item.cardTitle} · {item.supplierName}</span></div><StatusBadge status={item.status} compact /></Link>) : <EmptyState title="Очередь пуста" description="Открытых эскалаций нет." />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Последние изменения</CardTitle><CardAction><Link to="/procurement/activity">Журнал</Link></CardAction></CardHeader><CardContent className="pr-activity-list">{data.recentActivity?.map(item => <div className="pr-activity" key={item.id}><div className={`pr-activity__dot pr-activity__dot--${item.level}`} /><div><strong>{item.title}</strong><p>{item.description}</p><time>{new Date(item.createdAt).toLocaleString('ru-RU')}</time></div></div>)}</CardContent></Card></div>
    {data.kpis?.failures > 0 && <Alert><AlertTriangle /><AlertTitle>Есть необработанные сбои</AlertTitle><AlertDescription><p>Ошибки интеграций и вложений показаны отдельно от бизнес-статусов и не скрываются автоматическими повторами.</p><Link to="/procurement/activity?level=error">Открыть ошибки</Link></AlertDescription></Alert>}
  </div>
}
