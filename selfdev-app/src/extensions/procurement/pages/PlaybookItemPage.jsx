import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { DetailLayout } from '../components/DetailLayout'
import { SelectField } from '../components/SelectField'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import {
  GUARD_LABELS, KIND_SINGULAR, STAGE_LABELS, TOPIC_LABELS,
} from '../lib/playbookLabels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CircleAlert } from '../components/icons'

const EMPTY = {
  kind: 'DIRECTIVE', title: '', body: '', language: 'any', topic: null,
  scope: { cardIds: [], supplierIds: [], countries: [], channels: [], stages: [] },
  forbidsDisclosure: [], verbatim: false, enabled: true,
}

const csv = values => (values || []).join(', ')
const parseCsv = value => String(value || '').split(',').map(part => part.trim()).filter(Boolean)
const formatDate = value => (value ? new Date(value).toLocaleString('ru-RU') : '—')
const mutationMessage = error => error?.response?.data?.message || error?.message

function Chips({ options, selected, labels, onToggle }) {
  return (
    <div className="pr-inline-actions">
      {options.map(value => (
        <Button
          key={value}
          size="sm"
          variant={selected.includes(value) ? 'secondary' : 'outline'}
          onPress={() => onToggle(value)}
        >
          {labels[value] || value}
        </Button>
      ))}
    </div>
  )
}

export default function PlaybookItemPage() {
  const { itemId } = useParams()
  const isNew = !itemId || itemId === 'new'
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  // A rule proposed from a human edit arrives here as router state rather than
  // as a saved draft: nothing exists until this form is submitted.
  const prefill = location.state?.prefill || null
  const { canWritePlaybook, canApprovePlaybook } = useProcurementPermissions()

  const vocabulary = useQuery({
    queryKey: procurementKeys.playbookVocabulary(),
    queryFn: ({ signal }) => procurementApi.playbookVocabulary({ signal }),
  })
  const item = useQuery({
    queryKey: procurementKeys.playbookItem(itemId),
    queryFn: ({ signal }) => procurementApi.playbookItem(itemId, signal),
    enabled: !isNew,
  })
  const usage = useQuery({
    queryKey: procurementKeys.playbookItemUsage(itemId),
    queryFn: ({ signal }) => procurementApi.playbookItemUsage(itemId, signal),
    enabled: !isNew,
  })

  const [form, setForm] = useState(() => (prefill ? { ...EMPTY, ...prefill, scope: { ...EMPTY.scope, ...prefill.scope } } : EMPTY))
  const [summary, setSummary] = useState('')
  useEffect(() => {
    if (item.data) setForm({ ...EMPTY, ...item.data, scope: { ...EMPTY.scope, ...item.data.scope } })
  }, [item.data])

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        body: form.body,
        language: form.language,
        topic: form.kind === 'BLOCK' ? form.topic : null,
        scope: {
          cardIds: form.scope.cardIds.map(Number).filter(Number.isFinite),
          supplierIds: form.scope.supplierIds,
          countries: form.scope.countries,
          channels: form.scope.channels,
          stages: form.scope.stages,
        },
        forbidsDisclosure: form.kind === 'DIRECTIVE' ? form.forbidsDisclosure : [],
        verbatim: form.verbatim,
        enabled: form.enabled,
      }
      if (isNew && prefill?.provenance) {
        payload.provenance = prefill.provenance
        payload.sourceCompositionId = prefill.sourceCompositionId
      }
      return isNew
        ? procurementApi.createPlaybookItem({ ...payload, kind: form.kind })
        : procurementApi.updatePlaybookItem(itemId, { ...payload, summary })
    },
    onSuccess: saved => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      navigate(`/procurement/communication/playbook/${saved.itemId}`)
    },
  })

  if (!isNew && item.isLoading) return <LoadingState />
  if (!isNew && item.isError) return <ErrorState error={item.error} onRetry={item.refetch} />

  const vocab = vocabulary.data || {}
  const lockedKind = form.kind === 'LOCKED_CLAUSE'
  const editable = canWritePlaybook && (!lockedKind || canApprovePlaybook)
  const setScope = (key, value) => setForm(prev => ({ ...prev, scope: { ...prev.scope, [key]: value } }))
  const toggleIn = (list, value) =>
    (list.includes(value) ? list.filter(entry => entry !== value) : [...list, value])

  return (
    <DetailLayout
      backTo="/procurement/communication"
      backLabel="Библиотека коммуникации"
      eyebrow={KIND_SINGULAR[form.kind] || form.kind}
      title={isNew ? 'Новый элемент библиотеки' : form.title || 'Элемент библиотеки'}
      status={!isNew && <Badge variant="outline">версия {form.version}</Badge>}
    >
        {!editable && (
          <Alert>
            <CircleAlert />
            <AlertTitle>Только просмотр</AlertTitle>
            <AlertDescription>
              {lockedKind
                ? 'Обязательные формулировки уходят в каждое сообщение, поэтому их правка требует права PLAYBOOK_APPROVE.'
                : 'Для изменения библиотеки нужно право PLAYBOOK_WRITE.'}
            </AlertDescription>
          </Alert>
        )}

        {save.isError && (
          <Alert>
            <CircleAlert />
            <AlertTitle>Не сохранено</AlertTitle>
            <AlertDescription>{mutationMessage(save.error)}</AlertDescription>
          </Alert>
        )}

        <div className="pr-form-grid">
          {isNew && (
            <SelectField
              label="Тип"
              required
              selectedKey={form.kind}
              onSelectionChange={value => setForm(prev => ({ ...prev, kind: String(value) }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(vocab.kinds || ['DIRECTIVE', 'BLOCK', 'LOCKED_CLAUSE']).map(value => (
                  <SelectItem key={value} id={value}>{KIND_SINGULAR[value] || value}</SelectItem>
                ))}
              </SelectContent>
            </SelectField>
          )}

          <label className="pr-form-field pr-form-field--wide">
            <span>Название *</span>
            <Input
              value={form.title}
              isDisabled={!editable}
              onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
            />
          </label>

          <label className="pr-form-field pr-form-field--wide">
            <span>Текст *</span>
            <Textarea
              rows={6}
              value={form.body}
              isDisabled={!editable}
              onChange={event => setForm(prev => ({ ...prev, body: event.target.value }))}
            />
            <small className="pr-muted">
              {form.kind === 'DIRECTIVE' && 'Инструкция агенту обычным языком. Попадёт в промпт как указание закупщика.'}
              {form.kind === 'BLOCK' && 'Позиция компании по теме. Агент ответит из этого текста или не станет отвечать вовсе.'}
              {form.kind === 'LOCKED_CLAUSE' && 'Дословный текст. Сообщение без него не будет отправлено.'}
            </small>
          </label>

          {form.kind === 'BLOCK' && (
            <SelectField
              label="Тема"
              required
              selectedKey={form.topic || ''}
              isDisabled={!editable}
              onSelectionChange={value => setForm(prev => ({ ...prev, topic: String(value) }))}
            >
              <SelectTrigger><SelectValue placeholder="Выберите тему" /></SelectTrigger>
              <SelectContent>
                {(vocab.topics || []).map(value => (
                  <SelectItem key={value} id={value}>{TOPIC_LABELS[value] || value}</SelectItem>
                ))}
              </SelectContent>
            </SelectField>
          )}

          <SelectField
            label="Язык"
            selectedKey={form.language}
            isDisabled={!editable}
            onSelectionChange={value => setForm(prev => ({ ...prev, language: String(value) }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem id="any">Любой</SelectItem>
              <SelectItem id="ru">Русский</SelectItem>
              <SelectItem id="en">Английский</SelectItem>
            </SelectContent>
          </SelectField>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Область применения</CardTitle>
            <p className="pr-muted">
              Пустое поле означает «без ограничения». Более узкое правило применяется после общего,
              поэтому оно и оказывается решающим.
            </p>
          </CardHeader>
          <CardContent>
            <div className="pr-form-field pr-form-field--wide">
              <span>Стадии диалога</span>
              <Chips
                options={vocab.stages || Object.keys(STAGE_LABELS)}
                selected={form.scope.stages}
                labels={STAGE_LABELS}
                onToggle={value => editable && setScope('stages', toggleIn(form.scope.stages, value))}
              />
            </div>
            <div className="pr-form-grid">
              <label className="pr-form-field">
                <span>Страны (ISO, через запятую)</span>
                <Input
                  value={csv(form.scope.countries)}
                  isDisabled={!editable}
                  placeholder="CN, IN"
                  onChange={event => setScope('countries', parseCsv(event.target.value).map(value => value.toUpperCase()))}
                />
              </label>
              <label className="pr-form-field">
                <span>Каналы</span>
                <Input
                  value={csv(form.scope.channels)}
                  isDisabled={!editable}
                  placeholder="email, whatsapp"
                  onChange={event => setScope('channels', parseCsv(event.target.value).map(value => value.toLowerCase()))}
                />
              </label>
              <label className="pr-form-field">
                <span>ID поставщиков</span>
                <Input
                  value={csv(form.scope.supplierIds)}
                  isDisabled={!editable}
                  onChange={event => setScope('supplierIds', parseCsv(event.target.value))}
                />
              </label>
              <label className="pr-form-field">
                <span>Номера карточек</span>
                <Input
                  value={csv(form.scope.cardIds)}
                  isDisabled={!editable}
                  onChange={event => setScope('cardIds', parseCsv(event.target.value))}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {form.kind === 'DIRECTIVE' && (
          <Card>
            <CardHeader>
              <CardTitle>Запрет на раскрытие</CardTitle>
              <p className="pr-muted">
                Единственная часть директивы, которая не просто просит модель, а проверяется кодом:
                перед отправкой сообщение сверяется с этими полями карточки.
              </p>
            </CardHeader>
            <CardContent>
              <Chips
                options={vocab.disclosureGuards || Object.keys(GUARD_LABELS)}
                selected={form.forbidsDisclosure}
                labels={GUARD_LABELS}
                onToggle={value => editable && setForm(prev => ({
                  ...prev, forbidsDisclosure: toggleIn(prev.forbidsDisclosure, value),
                }))}
              />
            </CardContent>
          </Card>
        )}

        {editable && (
          <div className="pr-form-actions">
            {!isNew && (
              <label className="pr-form-field pr-form-field--wide">
                <span>Что изменилось</span>
                <Input
                  value={summary}
                  placeholder="Останется в истории изменений"
                  onChange={event => setSummary(event.target.value)}
                />
              </label>
            )}
            <div className="pr-inline-actions">
              <Button
                isDisabled={save.isPending || !form.title.trim() || !form.body.trim()}
                onPress={() => save.mutate()}
              >
                Сохранить
              </Button>
            </div>
          </div>
        )}

        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle>Где применялось</CardTitle>
              <p className="pr-muted">
                Правило, которое нельзя проследить до реального письма, невозможно и оценить.
              </p>
            </CardHeader>
            <CardContent>
              {usage.data?.compositions?.length
                ? <ul className="pr-usage-list">
                  {usage.data.compositions.map(record => (
                    <li key={record.compositionId}>
                      <Link to={`/procurement/communication/drafts/${record.compositionId}`}>
                        {record.compositionId}
                      </Link>
                      <span className="pr-muted"> · {formatDate(record.createdAt)} · {record.channel}</span>
                    </li>
                  ))}
                </ul>
                : <p className="pr-muted">Это правило ещё не участвовало ни в одном сообщении.</p>}
              {item.data?.history?.length > 0 && (
                <>
                  <h4>История изменений</h4>
                  <ul className="pr-usage-list">
                    {item.data.history.map(revision => (
                      <li key={revision.version}>
                        v{revision.version} · {formatDate(revision.changedAt)} · {revision.summary}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        )}
    </DetailLayout>
  )
}
