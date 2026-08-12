import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Check, FileCheck, Refresh, Search, Sliders } from '../components/icons'
import { RouterLinkButton } from '../../../components/RouterLinkButton'

function message(error) {
  return error?.response?.data?.message || error?.message || 'Операция с RFQ не выполнена.'
}

// The short versions are what a marketplace form can hold; the long ones are
// written for email. Both are kept so neither has to be truncated on the way out.
// Short first, deliberately: the buyer asked for shorter openers, so the version
// that actually goes out on first contact is the one a specialist sees first.
const VERSIONS = [
  { key: 'russianShort', tab: 'ru-short', label: 'Русская, короткая', kind: 'short' },
  { key: 'englishShort', tab: 'en-short', label: 'English, short', kind: 'short' },
  { key: 'russian', tab: 'ru', label: 'Русская, полная', kind: 'long' },
  { key: 'english', tab: 'en', label: 'English, full', kind: 'long' },
]

const DEFAULT_TAB = VERSIONS[0].tab

const SHORT_LIMIT = 1800

function RFQVersion({ version, meta, canEdit, onSave, isSaving, saveError }) {
  const [draft, setDraft] = useState(null)
  const editing = draft !== null
  const tooLong = meta.kind === 'short' && editing && draft.bodyMarkdown.length > SHORT_LIMIT

  return <Card className="pr-rfq-document">
    <CardHeader>
      <div>
        <div className="pr-rfq-subject-label">Тема письма</div>
        {editing
          ? <Input value={draft.subject} onChange={event => setDraft(v => ({ ...v, subject: event.target.value }))} />
          : <CardTitle>{version.subject}</CardTitle>}
      </div>
      {canEdit && !editing && (
        <Button variant="outline" size="sm" onPress={() => setDraft({ subject: version.subject, bodyMarkdown: version.bodyMarkdown })}>
          <Sliders size={14} />Редактировать
        </Button>
      )}
    </CardHeader>
    <CardContent>
      {saveError && <Alert><AlertTriangle /><AlertTitle>Версия не сохранена</AlertTitle><AlertDescription>{message(saveError)}</AlertDescription></Alert>}
      {editing ? <>
        <Textarea className="pr-rfq-editor" value={draft.bodyMarkdown} onChange={event => setDraft(v => ({ ...v, bodyMarkdown: event.target.value }))} />
        <small className={`pr-quantity-hint${tooLong ? ' is-differs' : ''}`}>
          {draft.bodyMarkdown.length}{meta.kind === 'short' ? ` / ${SHORT_LIMIT}` : ''} символов
          {meta.kind === 'short' ? ' · этот текст уходит в форму на сайте, поэтому лимит жёсткий' : ''}
        </small>
        <div className="pr-rfq-confirm-actions">
          <Button variant="outline" isDisabled={isSaving} onPress={() => setDraft(null)}>Отмена</Button>
          <Button isDisabled={isSaving || tooLong || !draft.bodyMarkdown.trim() || !draft.subject.trim()}
            onPress={async () => { const ok = await onSave(meta.key, draft); if (ok) setDraft(null) }}>
            {isSaving ? 'Сохранение…' : 'Сохранить версию'}
          </Button>
        </div>
        <p className="pr-note">Правка отзывает согласование: подтвердить нужно будет именно то, что вы написали.</p>
      </> : (
        meta.kind === 'short'
          ? <pre className="pr-rfq-short">{version.bodyMarkdown}</pre>
          : <div className="pr-rfq-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{version.bodyMarkdown}</ReactMarkdown></div>
      )}
    </CardContent>
  </Card>
}

export default function RFQPage() {
  const { requestId } = useParams()
  const queryClient = useQueryClient()
  const { canWriteCards } = useProcurementPermissions()
  const [language, setLanguage] = useState(DEFAULT_TAB)
  const [reviewed, setReviewed] = useState(() => new Set([DEFAULT_TAB]))
  const [savingVersion, setSavingVersion] = useState('')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const query = useQuery({ queryKey: procurementKeys.rfq(requestId), queryFn: ({ signal }) => procurementApi.rfq(requestId, signal) })

  const updateCaches = value => {
    queryClient.setQueryData(procurementKeys.rfq(requestId), value)
    queryClient.invalidateQueries({ queryKey: procurementKeys.card(requestId) })
    queryClient.invalidateQueries({ queryKey: procurementKeys.overview() })
  }
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareRFQ(requestId),
    onSuccess: value => {
      updateCaches(value)
      setLanguage(DEFAULT_TAB)
      setReviewed(new Set([DEFAULT_TAB]))
      setConfirmRegenerate(false)
    },
  })
  const approve = useMutation({
    mutationFn: fingerprint => procurementApi.approveRFQ(requestId, fingerprint),
    onSuccess: updateCaches,
  })
  const edit = useMutation({
    mutationFn: ({ key, draft }) => procurementApi.editRFQ(requestId, { [key]: draft }),
    onSuccess: value => { updateCaches(value); setSavingVersion('') },
    onError: () => setSavingVersion(''),
  })

  useEffect(() => {
    setLanguage(DEFAULT_TAB)
    setReviewed(new Set([DEFAULT_TAB]))
  }, [query.data?.documentFingerprint])

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Карточка не найдена" />

  const document = query.data
  const mutationError = prepare.error || approve.error
  const hasRFQ = Boolean(document.rfq)
  const ready = document.cardStatus === 'NORMALIZED'
  const isApproved = document.status === 'APPROVED'
  // Only the versions this bundle actually holds; older RFQs have no short ones.
  const available = VERSIONS.filter(meta => document.rfq?.[meta.key])
  const activeTab = available.some(meta => meta.tab === language)
    ? language
    : available[0]?.tab || DEFAULT_TAB
  const bothReviewed = available.every(meta => reviewed.has(meta.tab))
  const effects = document.effects

  const chooseLanguage = value => {
    setLanguage(value)
    setReviewed(current => new Set([...current, value]))
  }

  const actions = hasRFQ ? <>{canWriteCards && <Button variant="outline" isDisabled={prepare.isPending || approve.isPending} onPress={() => setConfirmRegenerate(true)}><Refresh />Сформировать заново</Button>}{isApproved && <RouterLinkButton to={`/procurement/requests/${requestId}/sourcing`}><Search />Поиск поставщиков</RouterLinkButton>}</> : null

  return <DetailLayout
    backTo={`/procurement/requests/${requestId}`}
    backLabel="К карточке"
    eyebrow={hasRFQ ? document.rfq.id : `Карточка #${document.cardId}`}
    title={hasRFQ ? 'Предпросмотр RFQ' : 'Подготовка RFQ'}
    status={<StatusBadge status={document.status} />}
    meta={hasRFQ ? `Сформирован ${new Date(document.rfq.generatedAt).toLocaleString('ru-RU')}` : 'RFQ ещё не сформирован'}
    actions={actions}
    warnings={<>
      {mutationError && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{message(mutationError)}</AlertDescription></Alert>}
      {effects?.staleInquiries > 0 && <Alert><AlertTriangle /><AlertTitle>Связанные обращения устарели</AlertTitle><AlertDescription>{effects.staleInquiries} ранее подготовленных обращений помечено как STALE после регенерации RFQ.</AlertDescription></Alert>}
      {confirmRegenerate && <Alert><AlertTriangle /><AlertTitle>Заменить текущий RFQ?</AlertTitle><AlertDescription>Новый документ потребуется заново проверить и согласовать. Несохранённых отправок не произойдёт.<div className="pr-rfq-confirm-actions"><Button variant="outline" onPress={() => setConfirmRegenerate(false)}>Отмена</Button><Button isDisabled={prepare.isPending} onPress={() => prepare.mutate()}>{prepare.isPending ? 'Формирование…' : 'Да, сформировать заново'}</Button></div></AlertDescription></Alert>}
    </>}
  >
    {!hasRFQ && <Card><CardHeader><CardTitle>RFQ будет создан в четырёх версиях</CardTitle></CardHeader><CardContent>
      <p className="pr-note">Короткие версии — первый запрос поставщику: только ключевые вопросы, чтобы получить ответ, а не отпугнуть анкетой. Полные версии остаются для письма и для дозапроса. Все четыре сохраняются как один документ и согласуются вместе.</p>
      {!ready && <Alert><AlertTriangle /><AlertTitle>Карточка не готова</AlertTitle><AlertDescription>Перед подготовкой RFQ нормализуйте CAS-номер и наименование вещества.</AlertDescription></Alert>}
      {ready && canWriteCards && <Button isDisabled={prepare.isPending} onPress={() => prepare.mutate()}><FileCheck />{prepare.isPending ? 'Формирование…' : 'Подготовить RFQ'}</Button>}
      {ready && !canWriteCards && <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для подготовки RFQ требуется разрешение CARD_WRITE.</AlertDescription></Alert>}
    </CardContent></Card>}

    {hasRFQ && <div className="pr-stack">
      <Card><CardHeader><CardTitle>Состояние документа</CardTitle></CardHeader><CardContent><DefinitionGrid items={[
        { label: 'RFQ', value: document.rfq.id },
        { label: 'Статус', value: <StatusBadge status={document.status} /> },
        { label: 'Отправлен поставщику', value: document.sentToSupplier ? 'Да' : 'Нет' },
        { label: 'Согласован', value: document.approvedAt ? new Date(document.approvedAt).toLocaleString('ru-RU') : 'Нет' },
      ]} /></CardContent></Card>

      {isApproved && <Alert><FileCheck /><AlertTitle>RFQ согласован</AlertTitle><AlertDescription>Согласованы именно эти сохранённые версии. Документ ещё не отправлен поставщику — следующий шаг найти поставщиков и создать переговоры.</AlertDescription></Alert>}

      <Tabs selectedKey={activeTab} onSelectionChange={chooseLanguage}>
        <TabsList aria-label="Версия RFQ">{available.map(meta => (
          <TabsTrigger key={meta.tab} id={meta.tab}>{meta.label} {reviewed.has(meta.tab) && <Check />}</TabsTrigger>
        ))}</TabsList>
        {available.map(meta => (
          <TabsContent key={meta.tab} id={meta.tab}>
            <RFQVersion
              version={document.rfq[meta.key]}
              meta={meta}
              canEdit={canWriteCards}
              isSaving={savingVersion === meta.key}
              saveError={savingVersion === '' && edit.variables?.key === meta.key ? edit.error : null}
              onSave={async (key, draft) => {
                setSavingVersion(key)
                try { await edit.mutateAsync({ key, draft }); return true } catch { return false }
              }}
            />
          </TabsContent>
        ))}
      </Tabs>

      {!isApproved && <Card className="pr-rfq-approval"><CardHeader><CardTitle>Явное согласование</CardTitle></CardHeader><CardContent>
        <p>Откройте и проверьте каждую версию, включая короткие — именно они уходят в формы на сайтах поставщиков. Кнопка согласует только показанный документ; если RFQ изменится, сервер отклонит запрос.</p>
        <div className="pr-rfq-review-state">{available.map(meta => (
          <span key={meta.tab} className={reviewed.has(meta.tab) ? 'is-reviewed' : ''}><Check />{meta.label}</span>
        ))}</div>
        {canWriteCards
          ? <Button isDisabled={!bothReviewed || approve.isPending || prepare.isPending} onPress={() => approve.mutate(document.documentFingerprint)}><FileCheck />{approve.isPending ? 'Согласование…' : 'Согласовать этот RFQ'}</Button>
          : <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для согласования RFQ требуется разрешение CARD_WRITE.</AlertDescription></Alert>}
      </CardContent></Card>}
    </div>}
  </DetailLayout>
}
