import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import {
  channelChangeableNegotiationStatuses, isQueueableNegotiationStatus,
  negotiationNextActionLabel, toApiDateTime,
} from '../api/negotiations'
import { approvalPayload } from '../lib/compositions'
import { channelLabel, relativeTime, silenceSince } from '../lib/thread'
import { DetailLayout } from '../components/DetailLayout'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { NegotiationThread } from '../components/NegotiationThread'
import { StatusBadge } from '../components/StatusBadge'
import { SupplierWebsite } from '../components/SupplierLink'
import { WebFormRfq } from '../components/WebFormRfq'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, FileCheck, MessageSquare } from '../components/icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')

/** Everything about one supplier conversation, on the page it is run from. */
export default function NegotiationDetailPage() {
  const { negotiationId } = useParams()
  const queryClient = useQueryClient()
  const permissions = useProcurementPermissions()
  const {
    canQueueNegotiations, canManageNegotiations, canWriteSupplierResponses,
    canOperateEchemi, canSubmitEchemi, canReadCommunications,
  } = permissions
  const [failure, setFailure] = useState(null)

  const query = useQuery({
    queryKey: procurementKeys.negotiation(negotiationId),
    queryFn: ({ signal }) => procurementApi.negotiation(negotiationId, signal),
    // The change notice is written by the worker, so the page has to come back
    // for it; polling stops as soon as the draft exists.
    refetchInterval: current => (
      current?.state?.data?.cardChange?.draftStatus === 'PREPARING' ? 5000 : false
    ),
  })
  const compositions = useQuery({
    queryKey: procurementKeys.compositions({ assignmentId: negotiationId }),
    queryFn: ({ signal }) => procurementApi.compositions({ assignmentId: negotiationId }, signal),
    enabled: canReadCommunications,
  })

  const refresh = () => {
    setFailure(null)
    queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  }
  const run = mutation => ({
    ...mutation,
    mutate: (...args) => {
      setFailure(null)
      return mutation.mutate(...args)
    },
  })
  const onError = (error, label) => setFailure(
    `${label}: ${error?.response?.data?.message || error?.message || 'операция не выполнена'}`,
  )

  const queue = run(useMutation({
    mutationFn: nextActionAt => procurementApi.queueNegotiation(negotiationId, {
      priority: query.data?.priority ?? 50,
      next_action_at: nextActionAt ? toApiDateTime(nextActionAt) : null,
    }),
    onSuccess: refresh,
    onError: error => onError(error, 'Постановка в очередь'),
  }))
  const approve = run(useMutation({
    mutationFn: ({ record, text }) =>
      procurementApi.approveComposition(record.compositionId, approvalPayload(record, text)),
    onSuccess: refresh,
    onError: error => onError(error, 'Подтверждение сообщения'),
  }))
  const saveEdit = run(useMutation({
    mutationFn: ({ compositionId, text }) => procurementApi.saveCompositionEdit(compositionId, text),
    onSuccess: refresh,
    onError: error => onError(error, 'Сохранение правки'),
  }))
  const reject = run(useMutation({
    mutationFn: ({ compositionId, note }) => procurementApi.rejectComposition(compositionId, note),
    onSuccess: refresh,
    onError: error => onError(error, 'Отклонение черновика'),
  }))
  const compositionChannel = run(useMutation({
    mutationFn: ({ compositionId, contactId }) =>
      procurementApi.setCompositionChannel(compositionId, contactId),
    onSuccess: refresh,
    onError: error => onError(error, 'Смена канала черновика'),
  }))
  const negotiationChannel = run(useMutation({
    mutationFn: contactId => procurementApi.setNegotiationChannel(negotiationId, contactId),
    onSuccess: refresh,
    onError: error => onError(error, 'Смена канала переговоров'),
  }))
  const resolveChange = run(useMutation({
    mutationFn: action => procurementApi.resolveNegotiationCardChange(negotiationId, action),
    onSuccess: refresh,
    onError: error => onError(error, 'Решение по изменению карточки'),
  }))
  const prepareDraft = run(useMutation({
    mutationFn: () => procurementApi.prepareNegotiationChangeDraft(negotiationId),
    onSuccess: refresh,
    onError: error => onError(error, 'Подготовка черновика'),
  }))
  const createDraft = run(useMutation({
    mutationFn: ({ text }) => procurementApi.createNegotiationDraft(negotiationId, { text }),
    onSuccess: (_data, variables) => { variables.onDone?.(); refresh() },
    onError: error => onError(error, 'Черновик не создан'),
  }))
  const claimEscalation = run(useMutation({
    mutationFn: escalationId => procurementApi.claimEscalation(escalationId),
    onSuccess: refresh,
    onError: error => onError(error, 'Эскалация не взята в работу'),
  }))
  const resolveEscalation = run(useMutation({
    mutationFn: ({ escalationId, payload }) =>
      procurementApi.resolveEscalation(escalationId, payload),
    onSuccess: refresh,
    onError: error => onError(error, 'Решение по эскалации'),
  }))

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Переговоры не найдены" />

  const negotiation = query.data
  const change = negotiation.cardChange
  const paused = negotiation.status === 'PAUSED_BY_CHANGE'
  const silence = silenceSince(negotiation)
  const canQueue = canQueueNegotiations && isQueueableNegotiationStatus(negotiation.status)

  const actions = {
    approve: (record, text) => approve.mutate({ record, text }),
    saveEdit: (compositionId, text) => saveEdit.mutate({ compositionId, text }),
    reject: (compositionId, note) => reject.mutate({ compositionId, note }),
    setCompositionChannel: (compositionId, contactId) =>
      compositionChannel.mutate({ compositionId, contactId }),
    setNegotiationChannel: contactId => negotiationChannel.mutate(contactId),
    reschedule: value => value && queue.mutate(value),
    sendNow: () => queue.mutate(null),
    resolveCardChange: action => resolveChange.mutate(action),
    prepareDraft: () => prepareDraft.mutate(),
    createDraft: (text, onDone) => createDraft.mutate({ text, onDone }),
    claim: escalationId => claimEscalation.mutate(escalationId),
    resolve: (escalationId, payload) => resolveEscalation.mutate({ escalationId, payload }),
    pendingComposition: approve.isPending || saveEdit.isPending || reject.isPending
      ? approve.variables?.record?.compositionId
        || saveEdit.variables?.compositionId
        || reject.variables?.compositionId
      : null,
    pendingCardChange: resolveChange.isPending || prepareDraft.isPending,
    pendingEscalation: claimEscalation.isPending || resolveEscalation.isPending
      ? claimEscalation.variables || resolveEscalation.variables?.escalationId
      : null,
    pendingQueue: queue.isPending,
    pendingDraft: createDraft.isPending,
  }

  const warnings = <>
    {paused && (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Переговоры приостановлены: карточка изменилась</AlertTitle>
        <AlertDescription>
          Ниже, в ходе переговоров, показано что именно изменилось и три варианта:
          продолжить в этом треде, начать заново или остановить.
        </AlertDescription>
      </Alert>
    )}
    {(negotiation.requiresHuman || negotiation.lastWorkerError) && !paused && (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Требуется внимание специалиста</AlertTitle>
        <AlertDescription>
          {negotiation.lastWorkerError || 'Переговоры приостановлены до решения открытой эскалации.'}
        </AlertDescription>
      </Alert>
    )}
    {failure && (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Действие не выполнено</AlertTitle>
        <AlertDescription>{failure}</AlertDescription>
      </Alert>
    )}
  </>

  return (
    <DetailLayout
      backTo="/procurement/negotiations"
      backLabel="Все переговоры"
      eyebrow={negotiation.id}
      title={negotiation.supplierName}
      status={<StatusBadge status={negotiation.status} />}
      meta={<>
        <Link to={`/procurement/requests/${negotiation.cardId}`}>{negotiation.cardTitle}</Link>
        {' · '}
        <Link to={`/procurement/suppliers/${negotiation.supplierId}`}>
          {negotiation.contactName || negotiation.contactId}
        </Link>
        <SupplierWebsite supplierId={negotiation.supplierId} />
      </>}
      actions={<>
        {canWriteSupplierResponses && (
          <RouterLinkButton variant="outline" to={`/procurement/negotiations/${negotiation.id}/responses/new`}>
            <FileCheck />Обработать ответ
          </RouterLinkButton>
        )}
        <RouterLinkButton to={`/chat?context=procurement-negotiation:${negotiation.id}`}>
          <MessageSquare size={16} />Открыть разговор с агентом
        </RouterLinkButton>
      </>}
      warnings={warnings}
    >
      {/* One line for the question the page is opened with: what happens next,
          when, and through which channel. */}
      <div className="pr-nextbar">
        <StatusBadge status={negotiation.status} compact />
        <span>
          Следующее действие: <strong>{negotiationNextActionLabel(negotiation.nextAction)}</strong>
          {negotiation.nextActionAt
            ? <> · {formatDate(negotiation.nextActionAt)} ({relativeTime(negotiation.nextActionAt)})</>
            : ' · время не назначено'}
          {' · '}{channelLabel(negotiation.channel)}
        </span>
        {silence && <span className="pr-muted"><Clock size={13} /> поставщик молчит {silence} дн.</span>}
        {negotiation.escalations?.length > 0 && (
          <span className="pr-muted">открытых эскалаций: {negotiation.escalations.length}</span>
        )}
      </div>

      <div className="pr-thread-layout">
        <Card>
          <CardHeader>
            <CardTitle>Ход переговоров</CardTitle>
            <p className="pr-note">
              Полученные и отправленные сообщения, котировки под ними, решения и всё,
              что ещё не ушло поставщику — в одной ленте.
            </p>
          </CardHeader>
          <CardContent>
            <NegotiationThread
              negotiation={negotiation}
              compositions={compositions.data?.compositions || []}
              escalations={negotiation.escalations || []}
              actions={actions}
              permissions={permissions}
              canQueue={canQueue}
            />
          </CardContent>
        </Card>

        <aside className="pr-thread-rail">
          {negotiation.proposal && (
            <Card>
              <CardHeader>
                <CardTitle>Текущие условия</CardTitle>
                <CardAction>
                  <Link to={`/procurement/proposals/${negotiation.proposal.id}`}>Открыть</Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="pr-rail-list">
                  <div><dt>Цена</dt><dd>{negotiation.proposal.price
                    ? `${negotiation.proposal.price} ${negotiation.proposal.currency}/${negotiation.proposal.priceUnit}`
                    : 'нет данных'}</dd></div>
                  <div><dt>Базис</dt><dd>{negotiation.proposal.incoterm || '—'} {negotiation.proposal.namedPlace || ''}</dd></div>
                  <div><dt>MOQ</dt><dd>{negotiation.proposal.moq || '—'}</dd></div>
                  <div><dt>Срок</dt><dd>{negotiation.proposal.leadTime || '—'}</dd></div>
                  <div><dt>Готовность</dt><dd><StatusBadge status={negotiation.proposal.completeness} compact /></dd></div>
                </dl>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Каналы поставщика</CardTitle></CardHeader>
            <CardContent>
              <ul className="pr-rail-channels">
                {(negotiation.contacts || []).map(contact => (
                  <li key={contact.contactId} className={contact.isCurrent ? 'is-current' : ''}>
                    <strong>{channelLabel(contact.channel)}</strong>
                    <span>{contact.address}</span>
                    <StatusBadge status={contact.verificationStatus} compact />
                  </li>
                ))}
                {(negotiation.contacts || []).length === 0 && (
                  <li className="pr-muted">Контактов в справочнике нет.</li>
                )}
              </ul>
              {canManageNegotiations && channelChangeableNegotiationStatuses.has(negotiation.status) && (
                <p className="pr-note">
                  Канал переписки меняется у сообщения, которое ещё не ушло, — в ленте.
                </p>
              )}
              <Link to={`/procurement/suppliers/${negotiation.supplierId}/contacts/new`}>
                Добавить контакт
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Задание</CardTitle></CardHeader>
            <CardContent>
              <dl className="pr-rail-list">
                <div><dt>RFQ</dt><dd>
                  <Link to={`/procurement/requests/${negotiation.cardId}/rfq`}>{negotiation.rfqId || '—'}</Link>
                  {change && !change.rfqApproved && <StatusBadge status="DRAFT" label="новая версия не утверждена" compact />}
                </dd></div>
                <div><dt>Полномочия</dt><dd>{negotiation.authority || 'по умолчанию'}</dd></div>
                <div><dt>Follow-up</dt><dd>{negotiation.followUpAfterHours ? `каждые ${negotiation.followUpAfterHours} ч` : 'не задан'}</dd></div>
                <div><dt>Отправитель</dt><dd>{negotiation.buyerIdentity
                  ? `${negotiation.buyerIdentity.contact_name} · ${negotiation.buyerIdentity.email}`
                  : 'legacy configuration'}</dd></div>
                <div><dt>Последняя отправка</dt><dd>{formatDate(negotiation.lastDispatchAt)}</dd></div>
                <div><dt>Попыток</dt><dd>{negotiation.attemptCount ?? 0}</dd></div>
              </dl>
            </CardContent>
          </Card>

          {negotiation.peers?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>По этой же карточке</CardTitle>
                <CardAction>
                  <Link to={`/procurement/proposals/compare?cardId=${negotiation.cardId}`}>Сравнить</Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="pr-rail-peers">
                  {negotiation.peers.map(peer => (
                    <li key={peer.id}>
                      <Link to={`/procurement/negotiations/${peer.id}`}>{peer.supplierName}</Link>
                      <StatusBadge status={peer.status} compact />
                      <span>{peer.price ? `${peer.price} ${peer.currency}/${peer.priceUnit}` : '—'}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <WebFormRfq
        negotiationId={negotiation.id}
        cardId={negotiation.cardId}
        canManage={canManageNegotiations}
        canQueue={canQueueNegotiations}
        canOperateBrowser={canOperateEchemi}
        canSubmit={canSubmitEchemi}
      />
    </DetailLayout>
  )
}
