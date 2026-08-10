import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { echemiOperationIsError, echemiOperationLabel, echemiReadiness, echemiTerms, echemiUnits, initialEchemiDelivery } from '../api/echemi'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { EchemiBrowserAccess } from '../components/EchemiBrowserAccess'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Check, ExternalLink, FileCheck, Search } from '../components/icons'
import { SelectField } from '../components/SelectField'

export default function EchemiPage() {
  const { requestId } = useParams()
  const queryClient = useQueryClient()
  const { canOperateEchemi, canSubmitEchemi } = useProcurementPermissions()
  const [selectedProductId, setSelectedProductId] = useState('')
  const [delivery, setDelivery] = useState(initialEchemiDelivery())
  const [operation, setOperation] = useState(null)
  const [approveConfirmed, setApproveConfirmed] = useState('')
  const [submitConfirmed, setSubmitConfirmed] = useState('')
  const query = useQuery({ queryKey: procurementKeys.echemi(requestId), queryFn: ({ signal }) => procurementApi.echemi(requestId, signal) })
  const browserAccess = useQuery({
    queryKey: procurementKeys.echemiBrowserAccess(requestId),
    queryFn: ({ signal }) => procurementApi.echemiBrowserAccess(requestId, signal),
    enabled: canOperateEchemi,
    staleTime: 5 * 60 * 1000,
  })

  const accept = response => {
    queryClient.setQueryData(procurementKeys.echemi(requestId), response.state)
    queryClient.invalidateQueries({ queryKey: procurementKeys.card(requestId) })
    setOperation(response.operation)
  }
  const search = useMutation({ mutationFn: () => procurementApi.searchEchemi(requestId), onSuccess: accept })
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareEchemiInquiry(requestId, {
      product_id: selectedProductId, quantity: Number(delivery.quantity), unit: delivery.unit,
      shipment_term: delivery.shipmentTerm, destination: delivery.destination.trim(), country: delivery.country.trim().toUpperCase(),
    }),
    onSuccess: accept,
  })
  const lifecycle = useMutation({
    mutationFn: ({ action, inquiryId }) => ({
      preview: procurementApi.previewEchemiInquiry,
      approve: procurementApi.approveEchemiInquiry,
      submit: procurementApi.submitEchemiInquiry,
    })[action](requestId, inquiryId),
    onSuccess: (response, variables) => {
      accept(response)
      if (variables.action === 'approve') setApproveConfirmed('')
      if (variables.action === 'submit') setSubmitConfirmed('')
    },
  })

  useEffect(() => {
    if (query.data?.targetVolume) setDelivery(current => current.quantity ? current : initialEchemiDelivery(query.data.targetVolume))
  }, [query.data?.targetVolume])

  const eligible = useMemo(() => query.data?.search.results.filter(item => item.eligible_for_inquiry) || [], [query.data])
  useEffect(() => {
    if (selectedProductId && !eligible.some(item => item.product_id === selectedProductId)) setSelectedProductId('')
  }, [eligible, selectedProductId])

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Карточка не найдена" />

  const state = query.data
  const { searchReady, inquiryReady } = echemiReadiness(state.cardStatus, state.rfqStatus)
  const pendingError = search.error || prepare.error || lifecycle.error
  const formValid = selectedProductId && Number(delivery.quantity) > 0 && delivery.destination.trim() && /^[A-Za-z]{2}$/.test(delivery.country.trim())

  return <DetailLayout backTo={`/procurement/requests/${requestId}`} backLabel="К карточке" eyebrow={`Карточка #${state.cardId}`} title="Поиск и RFQ на Echemi" status={<StatusBadge status={state.search.status} />} meta={`CAS ${state.casNumber || '—'} · ${state.targetVolume || 'объём не указан'}`} warnings={<>
    {!searchReady && <Alert><AlertTriangle /><AlertTitle>Поиск ещё недоступен</AlertTitle><AlertDescription>Сначала нормализуйте карточку: поиск Echemi выполняется по подтверждённому CAS.</AlertDescription></Alert>}
    {searchReady && !inquiryReady && <Alert><AlertTriangle /><AlertTitle>Можно искать, но нельзя готовить inquiry</AlertTitle><AlertDescription>Поиск кандидатов уже доступен. Для подготовки формы требуется отдельно сформировать и явно согласовать RFQ.</AlertDescription></Alert>}
    {!canOperateEchemi && <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для операций Echemi требуется разрешение ECHEMI_OPERATE.</AlertDescription></Alert>}
    {pendingError && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{pendingError.response?.data?.message || pendingError.message}</AlertDescription></Alert>}
    {operation && <Alert><AlertTriangle /><AlertTitle>{echemiOperationIsError(operation) ? 'Операция остановлена' : operation.humanActionRequired ? 'Требуется ручная проверка' : 'Готово'}</AlertTitle><AlertDescription>{echemiOperationLabel(operation)}{operation.humanActionRequired && <div className="pr-echemi-alert-actions"><a href={state.noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Открыть проверку Echemi</a></div>}</AlertDescription></Alert>}
  </>}>
    <div className="pr-stack">
      {canOperateEchemi && <EchemiBrowserAccess access={browserAccess.data} error={browserAccess.error} loading={browserAccess.isLoading} />}
      <Card><CardHeader><CardTitle>1. Поиск продуктов</CardTitle></CardHeader><CardContent>
        <p className="pr-note">Поиск выполняется по CAS из нормализованной карточки. Листинги остаются непроверенными кандидатами и не становятся квалифицированными поставщиками автоматически.</p>
        <div className="pr-echemi-toolbar"><DefinitionGrid items={[{ label: 'CAS запроса', value: state.casNumber }, { label: 'Последний поиск', value: state.search.searchedAt ? new Date(state.search.searchedAt).toLocaleString('ru-RU') : 'Не запускался' }]} /><Button isDisabled={!searchReady || !canOperateEchemi || search.isPending} onPress={() => { setOperation(null); search.mutate() }}><Search />{search.isPending ? 'Поиск…' : state.search.status === 'HUMAN_ACTION_REQUIRED' ? 'Повторить после проверки' : 'Найти на Echemi'}</Button></div>
        {state.search.status === 'HUMAN_ACTION_REQUIRED' && <div className="pr-echemi-human"><span>Браузер оставлен открытым на странице проверки.</span><a href={state.noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Пройти проверку вручную</a></div>}
      </CardContent></Card>

      {state.search.status === 'COMPLETED' && <Card><CardHeader><CardTitle>2. Выбор листинга</CardTitle></CardHeader><CardContent>
        {eligible.length === 0 ? <EmptyState title="Безопасных кандидатов не найдено" description="Нельзя подготовить inquiry без точного CAS и однозначных product ID, продавца и URL." /> : <div className="pr-echemi-candidates">{eligible.map(item => <button type="button" className={selectedProductId === item.product_id ? 'is-selected' : ''} key={`${item.product_id}-${item.product_url}`} onClick={() => setSelectedProductId(item.product_id)}>
          <span className="pr-echemi-radio">{selectedProductId === item.product_id && <Check />}</span><span><strong>{item.product_name}</strong><small>{item.seller_name || 'Продавец не указан'} · product_id {item.product_id}</small><small>CAS {item.cas_number} · производитель не проверен</small></span><Badge variant="outline">UNVERIFIED</Badge>
        </button>)}</div>}
      </CardContent></Card>}

      {eligible.length > 0 && <Card><CardHeader><CardTitle>3. Параметры формы Echemi</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (formValid) prepare.mutate() }}>
        <label className="pr-form-field"><span>Количество <b>*</b></span><Input type="number" min="0.000001" step="any" value={delivery.quantity} onChange={event => setDelivery(value => ({ ...value, quantity: event.target.value }))} required /></label>
        <SelectField label="Единица" required selectedKey={delivery.unit} onSelectionChange={value => setDelivery(current => ({ ...current, unit: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{echemiUnits.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
        <SelectField label="Incoterm" required selectedKey={delivery.shipmentTerm} onSelectionChange={value => setDelivery(current => ({ ...current, shipmentTerm: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{echemiTerms.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
        <label className="pr-form-field"><span>Страна, ISO alpha-2 <b>*</b></span><Input maxLength={2} value={delivery.country} onChange={event => setDelivery(value => ({ ...value, country: event.target.value.toUpperCase() }))} required /></label>
        <label className="pr-form-field pr-form-field--wide"><span>Пункт назначения <b>*</b></span><Input value={delivery.destination} onChange={event => setDelivery(value => ({ ...value, destination: event.target.value }))} placeholder="Moscow" required /></label>
        <div className="pr-form-actions"><Button type="submit" isDisabled={!formValid || !inquiryReady || !canOperateEchemi || prepare.isPending}><FileCheck />{prepare.isPending ? 'Подготовка…' : 'Подготовить форму без отправки'}</Button></div>
      </form></CardContent></Card>}

      {state.inquiries.length > 0 && <section className="pr-stack"><div className="pr-section-heading"><div><h2>Подготовленные inquiry</h2><p>Каждая форма имеет стабильный ID, сохранённый payload и отдельные стадии preview, approval и submit.</p></div></div>{state.inquiries.map(inquiry => <Card key={inquiry.inquiryId} className="pr-echemi-inquiry"><CardHeader><div><CardTitle>{inquiry.inquiryId}</CardTitle><span>{inquiry.sellerName || 'Продавец не указан'}</span></div><StatusBadge status={inquiry.status} /></CardHeader><CardContent>
        {inquiry.status === 'HUMAN_ACTION_REQUIRED' && <Alert><AlertTriangle /><AlertTitle>Требуется проверка на Echemi</AlertTitle><AlertDescription>Браузерная сессия сохранена{inquiry.verificationStage ? ` · этап ${inquiry.verificationStage}` : ''}. Пройдите проверку вручную и повторите preview или отправку.<div className="pr-echemi-alert-actions"><a href={state.noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Открыть браузер Echemi</a></div></AlertDescription></Alert>}
        {inquiry.staleReason && <Alert><AlertTriangle /><AlertTitle>Черновик устарел</AlertTitle><AlertDescription>{inquiry.staleReason}</AlertDescription></Alert>}
        <DefinitionGrid items={[{ label: 'Продукт', value: inquiry.payload?.product_name }, { label: 'Количество', value: `${inquiry.payload?.quantity} ${inquiry.payload?.unit}` }, { label: 'Доставка', value: `${inquiry.payload?.shipment_term} — ${inquiry.payload?.destination}, ${inquiry.payload?.country}` }, { label: 'Preview', value: inquiry.previewedAt ? new Date(inquiry.previewedAt).toLocaleString('ru-RU') : 'Не выполнен' }]} />
        <details className="pr-echemi-payload"><summary>Точный payload формы</summary><DefinitionGrid items={[{ label: 'Компания', value: inquiry.payload?.company_name }, { label: 'Контакт', value: inquiry.payload?.contact_name }, { label: 'Email', value: inquiry.payload?.email }, { label: 'Телефон', value: `${inquiry.payload?.phone_country} ${inquiry.payload?.phone_number}` }]} /><pre>{inquiry.payload?.description}</pre></details>
        <div className="pr-echemi-actions">
          {['AWAITING_APPROVAL', 'APPROVED', 'HUMAN_ACTION_REQUIRED'].includes(inquiry.status) && <Button variant="outline" isDisabled={lifecycle.isPending || !canOperateEchemi} onPress={() => lifecycle.mutate({ action: 'preview', inquiryId: inquiry.inquiryId })}>Заполнить и проверить в noVNC</Button>}
          {inquiry.status === 'AWAITING_APPROVAL' && inquiry.previewedAt && <><label className="pr-echemi-confirm"><input type="checkbox" checked={approveConfirmed === inquiry.inquiryId} onChange={event => setApproveConfirmed(event.target.checked ? inquiry.inquiryId : '')} />Я проверил точный payload и форму</label><Button isDisabled={approveConfirmed !== inquiry.inquiryId || lifecycle.isPending || !canOperateEchemi} onPress={() => lifecycle.mutate({ action: 'approve', inquiryId: inquiry.inquiryId })}>Согласовать эту форму</Button></>}
          {['APPROVED', 'HUMAN_ACTION_REQUIRED'].includes(inquiry.status) && <><label className="pr-echemi-confirm"><input type="checkbox" checked={submitConfirmed === inquiry.inquiryId} onChange={event => setSubmitConfirmed(event.target.checked ? inquiry.inquiryId : '')} />Подтверждаю отправку именно этого inquiry</label><Button variant="destructive" isDisabled={!state.submissionEnabled || !canSubmitEchemi || submitConfirmed !== inquiry.inquiryId || lifecycle.isPending} onPress={() => lifecycle.mutate({ action: 'submit', inquiryId: inquiry.inquiryId })}>{inquiry.status === 'HUMAN_ACTION_REQUIRED' ? 'Продолжить отправку после проверки' : 'Отправить на Echemi'}</Button></>}
        </div>
        {!state.submissionEnabled && ['APPROVED', 'HUMAN_ACTION_REQUIRED'].includes(inquiry.status) && <p className="pr-note">Отправка заблокирована сервером. Для её включения задайте <code>ECHEMI_ENABLE_SUBMISSION=true</code> и перезапустите h9y-procurement.</p>}
      </CardContent></Card>)}</section>}
    </div>
  </DetailLayout>
}
