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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Check, FileCheck, Refresh } from '../components/icons'

function message(error) {
  return error?.response?.data?.message || error?.message || 'Операция с RFQ не выполнена.'
}

function Preview({ document, language }) {
  const version = language === 'ru' ? document.rfq.russian : document.rfq.english
  return <Card className="pr-rfq-document">
    <CardHeader><div className="pr-rfq-subject-label">Тема письма</div><CardTitle>{version.subject}</CardTitle></CardHeader>
    <CardContent><div className="pr-rfq-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{version.bodyMarkdown}</ReactMarkdown></div></CardContent>
  </Card>
}

export default function RFQPage() {
  const { requestId } = useParams()
  const queryClient = useQueryClient()
  const { canWriteCards } = useProcurementPermissions()
  const [language, setLanguage] = useState('ru')
  const [reviewed, setReviewed] = useState(() => new Set(['ru']))
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
      setLanguage('ru')
      setReviewed(new Set(['ru']))
      setConfirmRegenerate(false)
    },
  })
  const approve = useMutation({
    mutationFn: fingerprint => procurementApi.approveRFQ(requestId, fingerprint),
    onSuccess: updateCaches,
  })

  useEffect(() => {
    setLanguage('ru')
    setReviewed(new Set(['ru']))
  }, [query.data?.documentFingerprint])

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Карточка не найдена" />

  const document = query.data
  const mutationError = prepare.error || approve.error
  const hasRFQ = Boolean(document.rfq)
  const ready = document.cardStatus === 'NORMALIZED'
  const isApproved = document.status === 'APPROVED'
  const bothReviewed = reviewed.has('ru') && reviewed.has('en')
  const effects = document.effects

  const chooseLanguage = value => {
    setLanguage(value)
    setReviewed(current => new Set([...current, value]))
  }

  const actions = hasRFQ && canWriteCards
    ? <Button variant="outline" isDisabled={prepare.isPending || approve.isPending} onPress={() => setConfirmRegenerate(true)}><Refresh />Сформировать заново</Button>
    : null

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
    {!hasRFQ && <Card><CardHeader><CardTitle>RFQ будет создан в двух версиях</CardTitle></CardHeader><CardContent>
      <p className="pr-note">Генератор использует нормализованную карточку и настройки покупателя. Английская и русская версии сохраняются как один документ со статусом ожидания согласования.</p>
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

      {isApproved && <Alert><FileCheck /><AlertTitle>RFQ согласован</AlertTitle><AlertDescription>Согласована именно эта сохранённая двуязычная версия. Документ ещё не отправлен поставщику.</AlertDescription></Alert>}

      <Tabs selectedKey={language} onSelectionChange={chooseLanguage}>
        <TabsList aria-label="Язык RFQ"><TabsTrigger id="ru">Русская версия {reviewed.has('ru') && <Check />}</TabsTrigger><TabsTrigger id="en">English version {reviewed.has('en') && <Check />}</TabsTrigger></TabsList>
        <TabsContent id="ru"><Preview document={document} language="ru" /></TabsContent>
        <TabsContent id="en"><Preview document={document} language="en" /></TabsContent>
      </Tabs>

      {!isApproved && <Card className="pr-rfq-approval"><CardHeader><CardTitle>Явное согласование</CardTitle></CardHeader><CardContent>
        <p>Откройте и проверьте обе языковые версии. Кнопка согласует только показанный документ; если RFQ изменится, сервер отклонит запрос.</p>
        <div className="pr-rfq-review-state"><span className={reviewed.has('ru') ? 'is-reviewed' : ''}><Check />Русская версия</span><span className={reviewed.has('en') ? 'is-reviewed' : ''}><Check />English version</span></div>
        {canWriteCards
          ? <Button isDisabled={!bothReviewed || approve.isPending || prepare.isPending} onPress={() => approve.mutate(document.documentFingerprint)}><FileCheck />{approve.isPending ? 'Согласование…' : 'Согласовать этот RFQ'}</Button>
          : <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для согласования RFQ требуется разрешение CARD_WRITE.</AlertDescription></Alert>}
      </CardContent></Card>}
    </div>}
  </DetailLayout>
}
