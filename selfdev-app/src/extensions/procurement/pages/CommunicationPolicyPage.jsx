import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { DetailLayout } from '../components/DetailLayout'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { KIND_SINGULAR, STAGE_LABELS, TOPIC_LABELS } from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CircleAlert, Flask, Search } from '../components/icons'

const PERSONAS = [
  ['COOPERATIVE', 'Отвечает по существу'],
  ['TERSE', 'Односложно'],
  ['EVASIVE_ON_DOCUMENTS', 'Уклоняется от документов'],
  ['TRADER_CLAIMING_MANUFACTURER', 'Трейдер под видом производителя'],
  ['OFFERS_DIFFERENT_PRODUCT', 'Предлагает другой продукт'],
]

const parseCsv = value => String(value || '').split(',').map(part => part.trim()).filter(Boolean)
const mutationMessage = error => error?.response?.data?.message || error?.message

export default function CommunicationPolicyPage() {
  const queryClient = useQueryClient()
  const { canWritePlaybook } = useProcurementPermissions()

  const policy = useQuery({
    queryKey: procurementKeys.communicationPolicy(),
    queryFn: ({ signal }) => procurementApi.communicationPolicy({ signal }),
  })
  const vocabulary = useQuery({
    queryKey: procurementKeys.playbookVocabulary(),
    queryFn: ({ signal }) => procurementApi.playbookVocabulary({ signal }),
  })

  const [form, setForm] = useState({ draftFirstStages: [], draftFirstSupplierIds: [], draftFirstAll: false })
  useEffect(() => {
    if (policy.data) setForm(policy.data)
  }, [policy.data])

  const save = useMutation({
    mutationFn: () => procurementApi.updateCommunicationPolicy({
      draftFirstStages: form.draftFirstStages,
      draftFirstSupplierIds: form.draftFirstSupplierIds,
      draftFirstAll: form.draftFirstAll,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.communicationPolicy() }),
  })

  const [preview, setPreview] = useState({ stage: 'FIRST_CONTACT', cardId: '', supplierId: '', supplierMessage: '' })
  const [rehearsal, setRehearsal] = useState({ persona: 'COOPERATIVE', message: '', cardId: '', country: '', language: 'en' })
  const simulate = useMutation({
    mutationFn: () => procurementApi.simulateSupplierReply({
      persona: rehearsal.persona,
      message: rehearsal.message,
      cardId: rehearsal.cardId ? Number(rehearsal.cardId) : null,
      country: rehearsal.country || null,
      language: rehearsal.language,
    }),
  })
  const runPreview = useMutation({
    mutationFn: () => procurementApi.previewPlaybook({
      stage: preview.stage,
      cardId: preview.cardId ? Number(preview.cardId) : null,
      supplierId: preview.supplierId || null,
      supplierMessage: preview.supplierMessage,
      language: 'en',
    }),
  })

  if (policy.isLoading) return <LoadingState />
  if (policy.isError) return <ErrorState error={policy.error} onRetry={policy.refetch} />

  const stages = vocabulary.data?.stages || Object.keys(STAGE_LABELS)
  const toggleStage = value => setForm(prev => ({
    ...prev,
    draftFirstStages: prev.draftFirstStages.includes(value)
      ? prev.draftFirstStages.filter(entry => entry !== value)
      : [...prev.draftFirstStages, value],
  }))

  return (
    <DetailLayout
      backTo="/procurement/communication"
      backLabel="Библиотека коммуникации"
      eyebrow="Коммуникация"
      title="Политика проверки черновиков"
    >
      <Card>
        <CardHeader>
          <CardTitle>Когда сообщение показывается человеку до отправки</CardTitle>
          <p className="pr-muted">
            По умолчанию задерживается только первое обращение к поставщику — то, где цена ошибки
            выше всего, — а переписка в уже начатом диалоге идёт сама. Задержанное сообщение
            поставщику не уходит: оно ждёт в разделе сообщений.
          </p>
        </CardHeader>
        <CardContent>
          {!canWritePlaybook && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Только просмотр</AlertTitle>
              <AlertDescription>Для изменения политики нужно право PLAYBOOK_WRITE.</AlertDescription>
            </Alert>
          )}
          {save.isError && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Не сохранено</AlertTitle>
              <AlertDescription>{mutationMessage(save.error)}</AlertDescription>
            </Alert>
          )}

          <div className="pr-form-field pr-form-field--wide">
            <span>Задерживать на этих стадиях</span>
            <div className="pr-inline-actions">
              {stages.map(value => (
                <Button
                  key={value}
                  size="sm"
                  variant={form.draftFirstStages.includes(value) ? 'secondary' : 'outline'}
                  isDisabled={!canWritePlaybook}
                  onPress={() => toggleStage(value)}
                >
                  {STAGE_LABELS[value] || value}
                </Button>
              ))}
            </div>
          </div>

          <label className="pr-form-field pr-form-field--wide">
            <span>Всегда задерживать для этих поставщиков</span>
            <Input
              value={(form.draftFirstSupplierIds || []).join(', ')}
              isDisabled={!canWritePlaybook}
              placeholder="SUP-A19F, SUP-B72D"
              onChange={event => setForm(prev => ({ ...prev, draftFirstSupplierIds: parseCsv(event.target.value) }))}
            />
          </label>

          <div className="pr-inline-actions">
            <Button
              variant={form.draftFirstAll ? 'secondary' : 'outline'}
              size="sm"
              isDisabled={!canWritePlaybook}
              onPress={() => setForm(prev => ({ ...prev, draftFirstAll: !prev.draftFirstAll }))}
            >
              Задерживать вообще все сообщения
            </Button>
            {canWritePlaybook && (
              <Button isDisabled={save.isPending} onPress={() => save.mutate()}>Сохранить политику</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Репетиция ответа поставщика</CardTitle>
          <p className="pr-muted">
            Проверка первого письма до того, как его увидит настоящий поставщик. Ценность не в
            самой ролевой игре, а в ответе на вопрос «что моё письмо на самом деле вытянет»:
            письмо может читаться отлично и при этом не получить MOQ. Ответ синтетический и
            нигде не сохраняется — он не попадает ни в предложения, ни в сравнение, ни в экспорт.
          </p>
        </CardHeader>
        <CardContent>
          <div className="pr-form-field pr-form-field--wide">
            <span>Поведение поставщика</span>
            <div className="pr-inline-actions">
              {PERSONAS.map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={rehearsal.persona === value ? 'secondary' : 'outline'}
                  onPress={() => setRehearsal(prev => ({ ...prev, persona: value }))}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="pr-form-grid">
            <label className="pr-form-field">
              <span>Карточка закупки</span>
              <Input
                value={rehearsal.cardId}
                placeholder="1042"
                onChange={event => setRehearsal(prev => ({ ...prev, cardId: event.target.value }))}
              />
            </label>
            <label className="pr-form-field">
              <span>Страна поставщика</span>
              <Input
                value={rehearsal.country}
                placeholder="CN"
                onChange={event => setRehearsal(prev => ({ ...prev, country: event.target.value }))}
              />
            </label>
          </div>
          <label className="pr-form-field pr-form-field--wide">
            <span>Сообщение, которое проверяем</span>
            <Textarea
              rows={6}
              value={rehearsal.message}
              placeholder="Вставьте первое письмо или черновик, который хотите проверить"
              onChange={event => setRehearsal(prev => ({ ...prev, message: event.target.value }))}
            />
          </label>
          <Button
            isDisabled={!rehearsal.message.trim() || simulate.isPending}
            onPress={() => simulate.mutate()}
          >
            <Flask size={15} />{simulate.isPending ? 'Модель отвечает…' : 'Прогнать репетицию'}
          </Button>

          {simulate.isError && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Репетиция не выполнена</AlertTitle>
              <AlertDescription>{mutationMessage(simulate.error)}</AlertDescription>
            </Alert>
          )}

          {simulate.data && (
            <div className="pr-preview-result">
              <div className="pr-inline-actions">
                <Badge>{simulate.data.personaLabel}</Badge>
                <Badge variant="outline">не сохраняется</Badge>
              </div>
              <pre className="pr-message-text">{simulate.data.reply}</pre>
              <h4>
                {simulate.data.stillMissing?.length
                  ? `Останется дозапросить: ${simulate.data.stillMissing.length}`
                  : 'Письмо вытянуло все отслеживаемые поля'}
              </h4>
              <ul className="pr-simulation-fields">
                {(simulate.data.fields || []).map(field => (
                  <li key={field.field} className={field.elicited ? 'is-elicited' : 'is-missing'}>
                    <span>{field.label}</span>
                    <StatusBadge status={field.status} compact />
                  </li>
                ))}
              </ul>
              {simulate.data.extractionError && (
                <p className="pr-muted">
                  Разбор ответа не удался ({simulate.data.extractionError}) — показан только текст.
                </p>
              )}
              <p className="pr-muted">{simulate.data.disclaimer}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Проверить, что применится</CardTitle>
          <p className="pr-muted">
            Сухой прогон: показывает ровно тот набор правил и тот текст инструкций, которые получил бы
            агент, — не обращаясь ни к модели, ни к поставщику.
          </p>
        </CardHeader>
        <CardContent>
          <div className="pr-form-grid">
            <label className="pr-form-field">
              <span>Карточка закупки</span>
              <Input
                value={preview.cardId}
                placeholder="1042"
                onChange={event => setPreview(prev => ({ ...prev, cardId: event.target.value }))}
              />
            </label>
            <label className="pr-form-field">
              <span>Поставщик</span>
              <Input
                value={preview.supplierId}
                placeholder="SUP-A19F"
                onChange={event => setPreview(prev => ({ ...prev, supplierId: event.target.value }))}
              />
            </label>
          </div>
          <div className="pr-form-field pr-form-field--wide">
            <span>Стадия</span>
            <div className="pr-inline-actions">
              {stages.map(value => (
                <Button
                  key={value}
                  size="sm"
                  variant={preview.stage === value ? 'secondary' : 'outline'}
                  onPress={() => setPreview(prev => ({ ...prev, stage: value }))}
                >
                  {STAGE_LABELS[value] || value}
                </Button>
              ))}
            </div>
          </div>
          <label className="pr-form-field pr-form-field--wide">
            <span>Сообщение поставщика (необязательно)</span>
            <Textarea
              rows={4}
              value={preview.supplierMessage}
              placeholder="What is the application? Please confirm payment terms."
              onChange={event => setPreview(prev => ({ ...prev, supplierMessage: event.target.value }))}
            />
          </label>
          <Button isDisabled={runPreview.isPending} onPress={() => runPreview.mutate()}>
            <Search size={15} />Показать
          </Button>

          {runPreview.isError && (
            <Alert>
              <CircleAlert />
              <AlertTitle>Не удалось выполнить прогон</AlertTitle>
              <AlertDescription>{mutationMessage(runPreview.error)}</AlertDescription>
            </Alert>
          )}

          {runPreview.data && (
            <div className="pr-preview-result">
              <div className="pr-inline-actions">
                <Badge>{STAGE_LABELS[runPreview.data.stage] || runPreview.data.stage}</Badge>
                <Badge variant="outline">
                  {runPreview.data.reviewMode === 'DRAFT_FIRST' ? 'будет задержано' : 'уйдёт автоматически'}
                </Badge>
                {runPreview.data.detectedTopics?.map(topic => (
                  <Badge key={topic} variant="outline">{TOPIC_LABELS[topic] || topic}</Badge>
                ))}
              </div>
              <h4>Применится правил: {runPreview.data.appliedItems?.length || 0}</h4>
              <ul className="pr-usage-list">
                {(runPreview.data.appliedItems || []).map(item => (
                  <li key={item.itemId}>
                    <strong>{item.title}</strong>{' '}
                    <span className="pr-muted">{KIND_SINGULAR[item.kind] || item.kind}</span>
                  </li>
                ))}
              </ul>
              <details className="pr-diff">
                <summary>Текст инструкций, который получит агент</summary>
                <pre className="pr-message-text">{runPreview.data.brief}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </DetailLayout>
  )
}
