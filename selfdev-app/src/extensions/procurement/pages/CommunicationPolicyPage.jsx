import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { DetailLayout } from '../components/DetailLayout'
import { SupplierRehearsal } from '../components/SupplierRehearsal'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { KIND_SINGULAR, STAGE_LABELS, TOPIC_LABELS } from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CircleAlert, Search } from '../components/icons'

const parseCsv = value => String(value || '').split(',').map(part => part.trim()).filter(Boolean)
const mutationMessage = error => error?.response?.data?.message || error?.message

export default function CommunicationPolicyPage() {
  const queryClient = useQueryClient()
  const { canWritePlaybook, simulationEnabled } = useProcurementPermissions()

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
          <CardTitle>Что проверяем</CardTitle>
          <p className="pr-muted">
            Общий контекст для обеих проверок ниже: сухой прогон покажет, какие правила применятся
            к такому сообщению, а симулятор — что на такое письмо ответит поставщик. Карточка нужна,
            чтобы подставить её готовый RFQ и её вещество.
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
          {!preview.cardId && (
            <p className="pr-muted">
              Без номера карточки обе проверки работают, но правила, привязанные к конкретной
              карточке, не применятся, а готовый RFQ подставить будет неоткуда.
            </p>
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

      {simulationEnabled && (
        <SupplierRehearsal
          cardId={preview.cardId}
          showRfqPicker={Boolean(preview.cardId)}
        />
      )}
    </DetailLayout>
  )
}
