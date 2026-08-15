import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { followUpNegotiationStatuses, negotiationNextActionLabel, queueableNegotiationStatuses, toApiDateTime } from '../api/negotiations'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { WebFormRfq } from '../components/WebFormRfq'
import { ConversationTimeline } from '../components/ConversationTimeline'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Clock, FileCheck, MessageSquare } from '../components/icons'

const formatDate = value => value ? new Date(value).toLocaleString('ru-RU') : '—'

function mutationMessage(mutation) {
  return mutation.error?.response?.data?.message || mutation.error?.message
}

export default function NegotiationDetailPage() {
  const { negotiationId } = useParams()
  const queryClient = useQueryClient()
  const { canQueueNegotiations, canWriteSupplierResponses, canManageNegotiations, canOperateEchemi, canSubmitEchemi, canReadCommunications } = useProcurementPermissions()
  const [priority, setPriority] = useState('50')
  const [queueAt, setQueueAt] = useState('')
  const [queueConfirmed, setQueueConfirmed] = useState(false)
  const [followUpAt, setFollowUpAt] = useState('')
  const [followUpConfirmed, setFollowUpConfirmed] = useState(false)
  const query = useQuery({ queryKey: procurementKeys.negotiation(negotiationId), queryFn: ({ signal }) => procurementApi.negotiation(negotiationId, signal) })
  // Drafts the agent produced for this conversation, including the ones that
  // were never sent — the timeline merges them with the delivered messages.
  const compositions = useQuery({
    queryKey: procurementKeys.compositions({ assignmentId: negotiationId }),
    queryFn: ({ signal }) => procurementApi.compositions({ assignmentId: negotiationId }, signal),
    enabled: canReadCommunications,
  })

  const updateNegotiation = negotiation => {
    queryClient.setQueryData(procurementKeys.negotiation(negotiationId), negotiation)
    queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  }
  const queue = useMutation({
    mutationFn: () => procurementApi.queueNegotiation(negotiationId, {
      priority: Number(priority),
      next_action_at: toApiDateTime(queueAt),
    }),
    onSuccess: negotiation => { updateNegotiation(negotiation); setQueueConfirmed(false) },
  })
  const followUp = useMutation({
    mutationFn: () => procurementApi.scheduleNegotiationFollowUp(negotiationId, toApiDateTime(followUpAt)),
    onSuccess: negotiation => { updateNegotiation(negotiation); setFollowUpConfirmed(false) },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Переговоры не найдены" />
  const negotiation = query.data
  const queueAllowed = canQueueNegotiations && queueableNegotiationStatuses.has(negotiation.status)
  const followUpAllowed = canQueueNegotiations && followUpNegotiationStatuses.has(negotiation.status)
  const nextActionLabel = negotiationNextActionLabel(negotiation.nextAction)
  const warnings = <>
    {(negotiation.requiresHuman || negotiation.lastWorkerError) && <Alert><AlertTriangle /><AlertTitle>Требуется внимание специалиста</AlertTitle><AlertDescription>{negotiation.lastWorkerError || 'Переговоры приостановлены до решения открытой эскалации.'}</AlertDescription></Alert>}
    {(queue.isError || followUp.isError) && <Alert><AlertTriangle /><AlertTitle>Действие не выполнено</AlertTitle><AlertDescription>{mutationMessage(queue.isError ? queue : followUp)}</AlertDescription></Alert>}
  </>

  return <DetailLayout backTo="/procurement/negotiations" backLabel="Все переговоры" eyebrow={negotiation.id} title={negotiation.supplierName} status={<StatusBadge status={negotiation.status} />} meta={<><Link to={`/procurement/requests/${negotiation.cardId}`}>{negotiation.cardTitle}</Link> · <Link to={`/procurement/suppliers/${negotiation.supplierId}`}>{negotiation.contactName || negotiation.contactId}</Link></>} actions={<>{canWriteSupplierResponses && <RouterLinkButton variant="outline" to={`/procurement/negotiations/${negotiation.id}/responses/new`}><FileCheck />Обработать ответ</RouterLinkButton>}<RouterLinkButton to={`/chat?context=procurement-negotiation:${negotiation.id}`}><MessageSquare size={16} />Открыть разговор с агентом</RouterLinkButton></>} warnings={warnings}>
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Текущее состояние</CardTitle></CardHeader><CardContent><DefinitionGrid items={[{ label: 'Канал', value: negotiation.channel }, { label: 'Контакт', value: negotiation.contactName || negotiation.contactId }, { label: 'Проверка контакта', value: <StatusBadge status={negotiation.contactVerificationStatus || 'UNKNOWN'} /> }, { label: 'Доставка', value: <StatusBadge status={negotiation.lastDispatchStatus || 'UNKNOWN'} /> }, { label: 'Следующее действие', value: nextActionLabel }, { label: 'Время действия', value: formatDate(negotiation.nextActionAt) }, { label: 'Приоритет очереди', value: negotiation.priority ?? '—' }, { label: 'Попыток обработки', value: negotiation.attemptCount ?? 0 }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Основание задания</CardTitle></CardHeader><CardContent><DefinitionGrid items={[{ label: 'RFQ', value: negotiation.rfqId || '—' }, { label: 'Отправитель', value: negotiation.buyerIdentity ? `${negotiation.buyerIdentity.contact_name} · ${negotiation.buyerIdentity.email}` : 'Legacy configuration' }, { label: 'Полномочия', value: negotiation.authority || 'Безопасные полномочия по умолчанию' }, { label: 'Интервал follow-up', value: negotiation.followUpAfterHours ? `${negotiation.followUpAfterHours} ч` : 'Не задан' }, { label: 'Последняя отправка', value: formatDate(negotiation.lastDispatchAt) }, { label: 'Следующий follow-up', value: formatDate(negotiation.nextFollowUpAt) }]} /></CardContent></Card>
    </div>

    <WebFormRfq negotiationId={negotiation.id} cardId={negotiation.cardId} canManage={canManageNegotiations} canQueue={canQueueNegotiations} canOperateBrowser={canOperateEchemi} canSubmit={canSubmitEchemi} />

    {canQueueNegotiations && <div className="pr-detail-grid pr-negotiation-operations"><Card><CardHeader><CardTitle>Очередь отправки</CardTitle></CardHeader><CardContent>
      <p className="pr-note">После постановки в очередь worker сможет отправить согласованный RFQ или выполнить назначенный follow-up. Это отдельное действие с явным подтверждением.</p>
      <div className="pr-operation-fields"><label className="pr-form-field"><span>Приоритет, 0–100</span><Input type="number" min="0" max="100" value={priority} onChange={event => setPriority(event.target.value)} /></label><label className="pr-form-field"><span>Не раньше (необязательно)</span><Input type="datetime-local" value={queueAt} onChange={event => setQueueAt(event.target.value)} /></label></div>
      <label className="pr-operation-confirm"><input type="checkbox" checked={queueConfirmed} onChange={event => setQueueConfirmed(event.target.checked)} /><span>Подтверждаю постановку действия «{nextActionLabel}» в рабочую очередь.</span></label>
      <Button isDisabled={!queueAllowed || !queueConfirmed || priority === '' || Number(priority) < 0 || Number(priority) > 100 || queue.isPending} onPress={() => queue.mutate()}><MessageSquare />{queue.isPending ? 'Постановка…' : negotiation.status === 'QUEUED' ? 'Обновить очередь' : 'Поставить в очередь'}</Button>
      {!queueableNegotiationStatuses.has(negotiation.status) && <p className="pr-note">Из статуса {negotiation.status} постановка в очередь недоступна.</p>}
    </CardContent></Card><Card><CardHeader><CardTitle>Назначить follow-up</CardTitle></CardHeader><CardContent>
      <p className="pr-note">Follow-up доступен после исходящей отправки, когда переговоры ожидают ответа поставщика. Укажите точное будущее время.</p>
      <label className="pr-form-field"><span>Дата и время follow-up</span><Input type="datetime-local" value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} /></label>
      <label className="pr-operation-confirm"><input type="checkbox" checked={followUpConfirmed} onChange={event => setFollowUpConfirmed(event.target.checked)} /><span>Подтверждаю планирование уточняющего сообщения поставщику.</span></label>
      <Button variant="outline" isDisabled={!followUpAllowed || !followUpAt || !followUpConfirmed || new Date(followUpAt) <= new Date() || followUp.isPending} onPress={() => followUp.mutate()}><Clock />{followUp.isPending ? 'Планирование…' : 'Назначить follow-up'}</Button>
      {!followUpNegotiationStatuses.has(negotiation.status) && <p className="pr-note">Сначала исходный RFQ должен быть отправлен и задание должно перейти в ожидание поставщика.</p>}
    </CardContent></Card></div>}

    {negotiation.proposal && <Card><CardHeader><CardTitle>Текущие коммерческие условия</CardTitle><CardAction><Link to={`/procurement/proposals/${negotiation.proposal.id}`}>Открыть предложение</Link></CardAction></CardHeader><CardContent><DefinitionGrid items={[{ label: 'Цена', value: negotiation.proposal.price ? `${negotiation.proposal.price} ${negotiation.proposal.currency}/${negotiation.proposal.priceUnit}` : 'Нет данных' }, { label: 'Базис', value: `${negotiation.proposal.incoterm || '—'} ${negotiation.proposal.namedPlace || ''}` }, { label: 'MOQ', value: negotiation.proposal.moq }, { label: 'Готовность', value: <StatusBadge status={negotiation.proposal.completeness} /> }]} /></CardContent></Card>}
    <Card><CardHeader><CardTitle>Ход переговоров</CardTitle><p className="pr-note">Отправленные и полученные сообщения, черновики, которые агент подготовил, но не отправил, и смены статуса — в одной хронологии.</p></CardHeader><CardContent><ConversationTimeline negotiation={negotiation} compositions={compositions.data?.compositions || []} /></CardContent></Card>
  </DetailLayout>
}
