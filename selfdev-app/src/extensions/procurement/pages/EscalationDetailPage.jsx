import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { escalationActions, escalationOutcomeLabel, escalationOutcomes } from '../api/escalations'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Check, MessageSquare } from '../components/icons'
import { SelectField } from '../components/SelectField'

const formatDate = value => value ? new Date(value).toLocaleString('ru-RU') : '—'
const errorMessage = error => error?.response?.data?.message || error?.message || 'Действие не выполнено.'
const principalName = principal => principal?.display_name || principal?.principal_key || 'Неизвестный специалист'

function OutcomeSelect({ value, onChange, label }) {
  return <SelectField label={label} selectedKey={value} onSelectionChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{escalationOutcomes.map(item => <SelectItem key={item.value} id={item.value}>{item.label}</SelectItem>)}</SelectContent></SelectField>
}

export default function EscalationDetailPage() {
  const { escalationId } = useParams()
  const queryClient = useQueryClient()
  const permissions = useProcurementPermissions()
  const [recommendation, setRecommendation] = useState({ resolution: 'REQUEST_CLARIFICATION', decision: '' })
  const [resolution, setResolution] = useState({ resolution: 'REQUEST_CLARIFICATION', decision: '' })
  const [confirmed, setConfirmed] = useState(false)
  const query = useQuery({ queryKey: procurementKeys.escalation(escalationId), queryFn: ({ signal }) => procurementApi.escalation(escalationId, signal) })

  const update = escalation => {
    queryClient.setQueryData(procurementKeys.escalation(escalationId), escalation)
    queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  }
  const claim = useMutation({ mutationFn: () => procurementApi.claimEscalation(escalationId), onSuccess: update })
  const recommend = useMutation({
    mutationFn: () => procurementApi.recommendEscalation(escalationId, { ...recommendation, decision: recommendation.decision.trim() }),
    onSuccess: escalation => { update(escalation); setRecommendation(current => ({ ...current, decision: '' })) },
  })
  const resolve = useMutation({
    mutationFn: () => procurementApi.resolveEscalation(escalationId, { ...resolution, decision: resolution.decision.trim() }),
    onSuccess: escalation => { update(escalation); setConfirmed(false); setResolution(current => ({ ...current, decision: '' })) },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Эскалация не найдена" />

  const escalation = query.data
  const actions = escalationActions(escalation.status)
  const failed = [claim, recommend, resolve].find(item => item.isError)
  return <DetailLayout backTo="/procurement/escalations" backLabel="Очередь внимания" eyebrow={escalation.id} title={escalation.title} status={<StatusBadge status={escalation.status} />} meta={<>Приоритет {escalation.priority} · Ответственный: {escalation.assignedPrincipal ? principalName(escalation.assignedPrincipal) : escalation.assignedTo || 'не назначен'}</>} actions={<Link className="pr-inline-action" to={`/chat?context=procurement-escalation:${escalation.id}`}><MessageSquare size={16} />Обсудить с агентом</Link>} warnings={<>{failed && <Alert><AlertTriangle /><AlertTitle>Действие не выполнено</AlertTitle><AlertDescription>{errorMessage(failed.error)}</AlertDescription></Alert>}{escalation.status !== 'RESOLVED' && <Alert><AlertTriangle /><AlertTitle>Автоматическое решение не принимается</AlertTitle><AlertDescription>Кейс приостанавливает самостоятельное решение агента до явного действия уполномоченного специалиста.</AlertDescription></Alert>}</>}>
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Контекст решения</CardTitle></CardHeader><CardContent><p>{escalation.recommendation}</p><DefinitionGrid items={[{ label: 'Карточка', value: <Link to={`/procurement/requests/${escalation.cardId}`}>{escalation.cardTitle}</Link> }, { label: 'Поставщик', value: <Link to={`/procurement/suppliers/${escalation.supplierId}`}>{escalation.supplierName}</Link> }, { label: 'Переговоры', value: escalation.negotiationId ? <Link to={`/procurement/negotiations/${escalation.negotiationId}`}>{escalation.negotiationId}</Link> : '—' }, { label: 'Предложение', value: escalation.proposalId ? <Link to={`/procurement/proposals/${escalation.proposalId}`}>{escalation.proposalId}</Link> : '—' }, { label: 'Создана', value: formatDate(escalation.createdAt) }, { label: 'Обновлена', value: formatDate(escalation.updatedAt) }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Риски и основания</CardTitle></CardHeader><CardContent className="pr-risk-list">{escalation.risks?.map(risk => <div key={risk.code}><span className="pr-eyebrow">{risk.category} · {risk.code}</span><strong>{risk.reason}</strong>{risk.evidence?.map((evidence, index) => <blockquote key={index}>{evidence}</blockquote>)}</div>)}</CardContent></Card></div>

    {escalation.status === 'RESOLVED' && <Alert><Check /><AlertTitle>Решение принято: {escalationOutcomeLabel(escalation.resolution)}</AlertTitle><AlertDescription>{escalation.decision} · {escalation.decidedByPrincipal ? principalName(escalation.decidedByPrincipal) : escalation.decidedBy} · {formatDate(escalation.decidedAt)}</AlertDescription></Alert>}

    {actions.canClaim && permissions.canClaimEscalations && <Card><CardHeader><CardTitle>{escalation.status === 'RECOMMENDED' ? 'Принять кейс после рекомендации' : 'Взять в работу'}</CardTitle></CardHeader><CardContent><p className="pr-note">Кейс будет закреплён за вашей учётной записью. После этого только назначенный специалист сможет оставить заключение или принять решение.</p><Button isDisabled={claim.isPending} onPress={() => claim.mutate()}>{claim.isPending ? 'Назначение…' : 'Взять кейс в работу'}</Button></CardContent></Card>}

    <div className="pr-detail-grid pr-escalation-actions">
      {actions.canRecommend && permissions.canRecommendEscalations && <Card><CardHeader><CardTitle>Экспертная рекомендация</CardTitle></CardHeader><CardContent><p className="pr-note">Рекомендация фиксирует мнение специалиста, но не является окончательным решением и сама не возобновляет переговоры.</p><OutcomeSelect label="Рекомендуемый исход" value={recommendation.resolution} onChange={value => setRecommendation(current => ({ ...current, resolution: value }))} /><label className="pr-form-field"><span>Обоснование рекомендации</span><Textarea value={recommendation.decision} onChange={event => setRecommendation(current => ({ ...current, decision: event.target.value }))} placeholder="Какие факты проверены и что рекомендуется сделать?" /></label><Button variant="outline" isDisabled={!recommendation.decision.trim() || recommend.isPending} onPress={() => recommend.mutate()}>{recommend.isPending ? 'Сохранение…' : 'Сохранить рекомендацию'}</Button></CardContent></Card>}
      {actions.canResolve && permissions.canResolveEscalations && <Card><CardHeader><CardTitle>Окончательное решение</CardTitle></CardHeader><CardContent><p className="pr-note">Это действие завершает эскалацию. «Продолжить» и «Запросить уточнение» возвращают переговоры в работу; «Остановить» отменяет их, если других открытых эскалаций нет.</p><OutcomeSelect label="Итоговый исход" value={resolution.resolution} onChange={value => setResolution(current => ({ ...current, resolution: value }))} /><label className="pr-form-field"><span>Основание решения</span><Textarea value={resolution.decision} onChange={event => setResolution(current => ({ ...current, decision: event.target.value }))} placeholder="Зафиксируйте проверенные факты и основание финального решения." /></label><label className="pr-operation-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Подтверждаю, что это окончательное решение и понимаю его влияние на переговоры.</span></label><Button isDisabled={!resolution.decision.trim() || !confirmed || resolve.isPending} onPress={() => resolve.mutate()}>{resolve.isPending ? 'Принятие решения…' : 'Принять окончательное решение'}</Button></CardContent></Card>}
    </div>

    <Card><CardHeader><CardTitle>Рекомендации специалистов</CardTitle><CardAction>{escalation.recommendations?.length || 0}</CardAction></CardHeader><CardContent className="pr-escalation-history">{escalation.recommendations?.length ? [...escalation.recommendations].reverse().map((item, index) => <article key={`${item.createdAt}-${index}`}><StatusBadge status={item.resolution} label={escalationOutcomeLabel(item.resolution)} compact /><div><strong>{principalName(item.author)}</strong><p>{item.decision}</p></div><time>{formatDate(item.createdAt)}</time></article>) : <EmptyState title="Рекомендаций пока нет" />}</CardContent></Card>
    <Card><CardHeader><CardTitle>История статусов</CardTitle></CardHeader><CardContent className="pr-negotiation-history">{escalation.statusHistory?.length ? [...escalation.statusHistory].reverse().map((event, index) => <div key={`${event.changedAt}-${index}`}><StatusBadge status={event.toStatus} compact /><div><strong>{event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}</strong><span>{event.reason || 'Изменение статуса'} · {event.actor}</span></div><time>{formatDate(event.changedAt)}</time></div>) : <EmptyState title="История пока пуста" />}</CardContent></Card>
  </DetailLayout>
}
