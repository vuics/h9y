import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { DetailLayout } from '../components/DetailLayout'
import { StatusBadge } from '../components/StatusBadge'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import {
  approvalPayload, checkSummary, compositionActions, finalText, isPending,
} from '../lib/compositions'
import { suggestRule } from '../lib/learnFromEdit'
import {
  CHECK_LABELS, COMPOSITION_STATUS_LABELS, GUARD_LABELS, KIND_SINGULAR,
  STAGE_LABELS, TOPIC_LABELS, TRIGGER_LABELS,
} from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Check, CircleAlert, Clock } from '../components/icons'

const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')
const mutationMessage = error => error?.response?.data?.message || error?.message

const CHECK_TONE = { PASSED: 'ok', FAILED: 'bad', SKIPPED: 'muted' }

function CheckRow({ check }) {
  return (
    <li className={`pr-check pr-check--${CHECK_TONE[check.status] || 'muted'}`}>
      <span className="pr-check__mark">
        {check.status === 'PASSED' ? <Check size={14} />
          : check.status === 'FAILED' ? <AlertTriangle size={14} />
            : <Clock size={14} />}
      </span>
      <div>
        <strong>{CHECK_LABELS[check.check] || check.check}</strong>
        <p>{check.detail}</p>
      </div>
    </li>
  )
}

export default function CompositionDetailPage() {
  const { compositionId } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { canQueueNegotiations, canWritePlaybook } = useProcurementPermissions()

  const query = useQuery({
    queryKey: procurementKeys.composition(compositionId),
    queryFn: ({ signal }) => procurementApi.composition(compositionId, signal),
  })

  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (query.data) setText(finalText(query.data))
  }, [query.data])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: procurementKeys.all })
  const approve = useMutation({
    mutationFn: () =>
      procurementApi.approveComposition(compositionId, approvalPayload(query.data, text, note)),
    onSuccess: invalidate,
  })
  const reject = useMutation({
    mutationFn: () => procurementApi.rejectComposition(compositionId, note),
    onSuccess: invalidate,
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const record = query.data
  if (!record) return <ErrorState error={{ message: 'Сообщение не найдено.' }} />

  const actions = compositionActions(record.status, { canQueue: canQueueNegotiations })
  const pending = isPending(record.status)
  const failed = checkSummary(record.checks).blocking
  const original = finalText(record)
  const suggestion = suggestRule(record)

  return (
    <DetailLayout
      backTo="/procurement/communication/drafts"
      backLabel="Сообщения поставщикам"
      eyebrow={`${STAGE_LABELS[record.stage] || record.stage} · ${record.channel}`}
      title={record.compositionId}
      status={<StatusBadge status={record.status} />}
      meta={
        <>
          <span>{formatDate(record.createdAt)}</span>
          <span>повод: {TRIGGER_LABELS[record.trigger] || record.trigger}</span>
          {record.assignmentId && (
            <Link to={`/procurement/negotiations/${record.assignmentId}`}>{record.assignmentId}</Link>
          )}
          {record.cardId != null && (
            <Link to={`/procurement/requests/${record.cardId}`}>карточка #{record.cardId}</Link>
          )}
        </>
      }
      warnings={
        <>
          {record.status === 'BLOCKED' && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Сообщение не отправлено</AlertTitle>
              <AlertDescription>
                Не пройдены проверки, поэтому текст не ушёл поставщику.
                {failed.length > 0 && ` ${failed.map(check => check.detail).join(' ')}`}
              </AlertDescription>
            </Alert>
          )}
          {record.status === 'DRAFT' && (
            <Alert>
              <Clock />
              <AlertTitle>Ждёт вашего подтверждения</AlertTitle>
              <AlertDescription>
                По действующей политике сообщения этой стадии показываются человеку до отправки.
                Ничего поставщику пока не ушло.
              </AlertDescription>
            </Alert>
          )}
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Почему агент написал именно это</CardTitle>
          <p className="pr-muted">
            Состав сообщения записан в момент генерации: версии правил зафиксированы такими,
            какими они были применены.
          </p>
        </CardHeader>
        <CardContent>
          <div className="pr-attribution">
            <section>
              <h4>Что вызвало сообщение</h4>
              <ul className="pr-attribution__list">
                <li>Стадия: <strong>{STAGE_LABELS[record.stage] || record.stage}</strong></li>
                <li>Повод: <strong>{TRIGGER_LABELS[record.trigger] || record.trigger}</strong></li>
                {record.detectedTopics?.length > 0 && (
                  <li>
                    Темы в переписке:{' '}
                    <strong>{record.detectedTopics.map(topic => TOPIC_LABELS[topic] || topic).join(', ')}</strong>
                  </li>
                )}
                {record.missingFields?.length > 0 && (
                  <li>
                    Не хватает в предложении: <strong>{record.missingFields.join(', ')}</strong>
                  </li>
                )}
                {record.sourceResponseId && (
                  <li>
                    Ответ поставщика:{' '}
                    <Link to={`/procurement/proposals/${record.sourceResponseId}`}>
                      {record.sourceResponseId}
                    </Link>
                  </li>
                )}
              </ul>
            </section>

            <section>
              <h4>Применённые правила</h4>
              {record.appliedItems?.length
                ? <ul className="pr-attribution__list">
                  {record.appliedItems.map(item => (
                    <li key={`${item.itemId}-${item.version}`}>
                      <Link to={`/procurement/communication/playbook/${item.itemId}`}>{item.title}</Link>
                      <Badge variant="outline">{KIND_SINGULAR[item.kind] || item.kind}</Badge>
                      <Badge variant="outline">v{item.version}</Badge>
                      {item.topic && <Badge>{TOPIC_LABELS[item.topic] || item.topic}</Badge>}
                      <p className="pr-muted">{item.reason}</p>
                    </li>
                  ))}
                </ul>
                : <p className="pr-muted">Ни одно правило библиотеки не применялось.</p>}
            </section>

            {record.withheld?.length > 0 && (
              <section>
                <h4>Не раскрыто поставщику</h4>
                <p className="pr-muted">
                  Эти значения есть в карточке закупки, но директива запретила их называть,
                  и текст был проверен на их отсутствие.
                </p>
                <div className="pr-inline-actions">
                  {record.withheld.map(guard => (
                    <Badge key={guard} variant="outline">{GUARD_LABELS[guard] || guard}</Badge>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h4>Проверки перед отправкой</h4>
              <ul className="pr-check-list">
                {(record.checks || []).map(check => <CheckRow key={check.check} check={check} />)}
              </ul>
            </section>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Текст сообщения</CardTitle>
          {record.wasEdited && (
            <p className="pr-muted">Текст правил человек; исходный черновик агента сохранён ниже.</p>
          )}
        </CardHeader>
        <CardContent>
          {actions.canEdit
            ? <Textarea rows={14} value={text} onChange={event => setText(event.target.value)} />
            : <pre className="pr-message-text">{original}</pre>}

          {record.wasEdited && record.draftText !== record.editedText && (
            <details className="pr-diff">
              <summary>Исходный черновик агента</summary>
              <pre className="pr-message-text">{record.draftText}</pre>
            </details>
          )}
        </CardContent>
      </Card>

      {pending && (
        <Card>
          <CardHeader>
            <CardTitle>Решение</CardTitle>
            <p className="pr-muted">
              Подтверждение не отправляет сообщение само: оно фиксирует точный текст, который вы
              приняли, а доставкой занимается тот же рабочий процесс переговоров, что и всегда.
              Правки перепроверяются теми же правилами.
            </p>
          </CardHeader>
          <CardContent>
            {!canQueueNegotiations && (
              <Alert>
                <CircleAlert />
                <AlertTitle>Недостаточно прав</AlertTitle>
                <AlertDescription>
                  Для подтверждения и отклонения сообщений нужно право NEGOTIATION_QUEUE.
                </AlertDescription>
              </Alert>
            )}
            {approve.isError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Сообщение не подтверждено</AlertTitle>
                <AlertDescription>{mutationMessage(approve.error)}</AlertDescription>
              </Alert>
            )}
            {reject.isError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Не отклонено</AlertTitle>
                <AlertDescription>{mutationMessage(reject.error)}</AlertDescription>
              </Alert>
            )}
            <label className="pr-form-field pr-form-field--wide">
              <span>Комментарий</span>
              <Input
                value={note}
                placeholder="Останется в истории решения; для отклонения обязателен"
                onChange={event => setNote(event.target.value)}
              />
            </label>
            <div className="pr-inline-actions">
              <Button
                isDisabled={!actions.canApprove || approve.isPending || !text.trim()}
                onPress={() => approve.mutate()}
              >
                <Check size={15} />Подтвердить и отправить
              </Button>
              <Button
                variant="outline"
                isDisabled={!actions.canReject || reject.isPending || !note.trim()}
                onPress={() => reject.mutate()}
              >
                Не отправлять
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {suggestion && canWritePlaybook && (
        <Card>
          <CardHeader>
            <CardTitle>Сохранить правку как правило</CardTitle>
            <p className="pr-muted">
              Вы переписали то, что предложил агент — значит, применили знание, которого нет в
              библиотеке. Это черновик правила: он ничего не сохраняет, пока вы не откроете форму
              и не сохраните его сами.
            </p>
          </CardHeader>
          <CardContent>
            <pre className="pr-message-text">{suggestion.body}</pre>
            <p className="pr-muted">
              Область по умолчанию — этот поставщик и эта стадия: правка в одном диалоге является
              свидетельством об этом диалоге, а расширять её на всю установку — ваше решение.
            </p>
            <Button
              variant="outline"
              onPress={() => navigate('/procurement/communication/playbook/new', {
                state: { prefill: suggestion },
              })}
            >
              Открыть форму правила
            </Button>
          </CardContent>
        </Card>
      )}

      {!pending && record.decidedAt && (
        <p className="pr-muted">
          {COMPOSITION_STATUS_LABELS[record.status] || record.status} · {formatDate(record.decidedAt)}
          {record.decisionNote ? ` · ${record.decisionNote}` : ''}
        </p>
      )}
    </DetailLayout>
  )
}
