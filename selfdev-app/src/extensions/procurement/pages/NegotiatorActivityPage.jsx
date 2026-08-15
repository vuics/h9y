import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { StatusBadge } from '../components/StatusBadge'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CircleAlert, Clock, Inbox, MessageSquare, Refresh } from '../components/icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')
const mutationMessage = error => error?.response?.data?.message || error?.message

const KPI = [
  ['dueNow', 'Пора действовать'],
  ['awaitingReview', 'Черновиков ждут решения'],
  ['quarantine', 'Не опознано'],
  ['waitingSupplier', 'Ждём поставщика'],
  ['escalated', 'У специалиста'],
  ['queued', 'В очереди'],
]

function AssignmentList({ items, emptyTitle, emptyDescription, showTime = true }) {
  if (!items?.length) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return (
    <ul className="pr-activity-list">
      {items.map(item => (
        <li key={item.id}>
          <div className="pr-activity-list__head">
            <Link to={`/procurement/negotiations/${item.id}`}>{item.supplierName}</Link>
            <StatusBadge status={item.status} compact />
            <Badge variant="outline">{item.channel}</Badge>
          </div>
          <div className="pr-activity-list__meta">
            <Link to={`/procurement/requests/${item.cardId}`}>{item.cardTitle}</Link>
            {showTime && <span>{formatDate(item.nextActionAt)}</span>}
            {item.lastWorkerError && <span className="pr-activity-error">{item.lastWorkerError}</span>}
            {item.escalationReason && <span className="pr-activity-error">{item.escalationReason}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function QuarantineCard({ message, canResolve }) {
  const queryClient = useQueryClient()
  const [assignmentId, setAssignmentId] = useState('')
  const [reason, setReason] = useState('')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  const assign = useMutation({
    mutationFn: () => procurementApi.assignQuarantinedMessage(message.id, assignmentId.trim()),
    onSuccess: invalidate,
  })
  const dismiss = useMutation({
    mutationFn: () => procurementApi.dismissQuarantinedMessage(message.id, reason.trim()),
    onSuccess: invalidate,
  })

  return (
    <li className="pr-quarantine-item">
      <div className="pr-quarantine-item__head">
        <strong>{message.address || 'Отправитель не указан'}</strong>
        <Badge variant="outline">{message.channel}</Badge>
        <time>{formatDate(message.createdAt)}</time>
      </div>
      <pre className="pr-message-text">{message.text}</pre>
      {message.attachmentUrls?.length > 0 && (
        <p className="pr-muted">Вложений: {message.attachmentUrls.length}</p>
      )}
      {(assign.isError || dismiss.isError) && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Действие не выполнено</AlertTitle>
          <AlertDescription>
            {mutationMessage(assign.isError ? assign.error : dismiss.error)}
          </AlertDescription>
        </Alert>
      )}
      {canResolve && (
        <div className="pr-quarantine-item__actions">
          <label className="pr-form-field">
            <span>Отнести к переговорам</span>
            <Input
              value={assignmentId}
              placeholder="NEG-…"
              onChange={event => setAssignmentId(event.target.value)}
            />
          </label>
          <Button
            size="sm"
            isDisabled={!assignmentId.trim() || assign.isPending}
            onPress={() => assign.mutate()}
          >
            Обработать
          </Button>
          <label className="pr-form-field">
            <span>Причина отклонения</span>
            <Input
              value={reason}
              placeholder="Спам, не наш поставщик…"
              onChange={event => setReason(event.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            isDisabled={!reason.trim() || dismiss.isPending}
            onPress={() => dismiss.mutate()}
          >
            Отклонить
          </Button>
        </div>
      )}
    </li>
  )
}

export default function NegotiatorActivityPage() {
  const { canWriteSupplierResponses } = useProcurementPermissions()
  const query = useQuery({
    queryKey: procurementKeys.negotiationActivity(),
    queryFn: ({ signal }) => procurementApi.negotiationActivity({ signal }),
    refetchInterval: 30000,
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const data = query.data || {}
  const counts = data.counts || {}

  return (
    <div className="pr-stack">
      <div className="pr-section-heading">
        <div>
          <h2>Агент-переговорщик</h2>
          <p>
            Переговорщик работает в фоне и берёт задания сам. Здесь видно, что он делает
            сейчас, что запланировано и что застряло.
          </p>
        </div>
        <div className="pr-inline-actions">
          <span className="pr-muted">обновлено {formatDate(data.generatedAt)}</span>
          <Button variant="outline" size="sm" onPress={() => query.refetch()}>
            <Refresh size={14} />Обновить
          </Button>
        </div>
      </div>

      <div className="pr-kpi-row">
        {KPI.map(([key, label]) => (
          <div key={key} className={`pr-kpi${counts[key] ? '' : ' pr-kpi--zero'}`}>
            <strong>{counts[key] ?? 0}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {counts.awaitingReview > 0 && (
        <Alert>
          <Clock />
          <AlertTitle>Черновиков ждёт решения: {counts.awaitingReview}</AlertTitle>
          <AlertDescription>
            Эти сообщения поставщикам не отправлены.{' '}
            <Link to="/procurement/communication/drafts?status=DRAFT">Открыть очередь черновиков</Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="pr-detail-grid">
        <Card>
          <CardHeader>
            <CardTitle><Clock size={15} />Пора действовать</CardTitle>
            <p className="pr-note">Срок наступил, ожидают ближайшего прохода worker&apos;а.</p>
          </CardHeader>
          <CardContent>
            <AssignmentList
              items={data.dueNow}
              emptyTitle="Просроченных заданий нет"
              emptyDescription="Всё, что запланировано, ещё не наступило."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><MessageSquare size={15} />Запланировано</CardTitle>
            <p className="pr-note">Ближайшие отправки и напоминания.</p>
          </CardHeader>
          <CardContent>
            <AssignmentList
              items={data.scheduled}
              emptyTitle="Ничего не запланировано"
              emptyDescription="Поставьте переговоры в очередь или назначьте follow-up."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><AlertTriangle size={15} />Застряло</CardTitle>
          <p className="pr-note">
            Передано специалисту или последняя попытка обработки завершилась ошибкой.
            «Застряло» — не статус: задание может числиться активным, а его последний проход упасть.
          </p>
        </CardHeader>
        <CardContent>
          <AssignmentList
            items={data.stuck}
            emptyTitle="Ничего не застряло"
            emptyDescription="Ни одной эскалации и ни одной ошибки обработки."
            showTime={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><Inbox size={15} />Не опознанные сообщения</CardTitle>
          <p className="pr-note">
            Агент отказался приписать эти сообщения произвольному поставщику. Это его самое
            безопасное поведение — и самое незаметное, пока их некому увидеть.
          </p>
        </CardHeader>
        <CardContent>
          {!canWriteSupplierResponses && data.quarantine?.length > 0 && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Только просмотр</AlertTitle>
              <AlertDescription>
                Для обработки нужно право SUPPLIER_RESPONSE_WRITE.
              </AlertDescription>
            </Alert>
          )}
          {data.quarantine?.length
            ? <ul className="pr-quarantine-list">
              {data.quarantine.map(message => (
                <QuarantineCard
                  key={message.id}
                  message={message}
                  canResolve={canWriteSupplierResponses}
                />
              ))}
            </ul>
            : <EmptyState
              title="Все сообщения опознаны"
              description="Каждое входящее сообщение удалось связать с конкретными переговорами."
            />}
          {data.quarantineTotal > (data.quarantine?.length || 0) && (
            <p className="pr-muted">
              Показаны последние {data.quarantine.length} из {data.quarantineTotal}.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="pr-inline-actions">
        <RouterLinkButton to="/procurement/negotiations" variant="outline" size="sm">
          Все переговоры
        </RouterLinkButton>
        <RouterLinkButton to="/procurement/communication/drafts" variant="outline" size="sm">
          Сообщения поставщикам
        </RouterLinkButton>
      </div>
    </div>
  )
}
