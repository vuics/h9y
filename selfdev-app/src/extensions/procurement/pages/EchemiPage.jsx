import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { echemiOperationIsError, echemiOperationLabel, echemiReadiness, echemiTerms, echemiUnits, initialEchemiDelivery, quantityMatchesCard } from '../api/echemi'
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
import { AlertTriangle, Building, Check, ExternalLink, FileCheck, Inbox, Search } from '../components/icons'
import { SelectField } from '../components/SelectField'

export default function EchemiPage() {
  const { requestId } = useParams()
  const queryClient = useQueryClient()
  const { canOperateEchemi, canSubmitEchemi, canWriteSuppliers } = useProcurementPermissions()
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
  const registerSeller = useMutation({
    mutationFn: productId => procurementApi.registerEchemiSeller(requestId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.echemi(requestId) })
      queryClient.invalidateQueries({ queryKey: [...procurementKeys.all, 'suppliers'] })
    },
  })
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareEchemiInquiry(requestId, {
      product_id: selectedProductId, quantity: Number(delivery.quantity), unit: delivery.unit,
      shipment_term: delivery.shipmentTerm, destination: delivery.destination.trim(), country: delivery.country.trim().toUpperCase(),
    }),
    onSuccess: accept,
  })
  const collectQuotations = useMutation({
    mutationFn: () => procurementApi.collectEchemiQuotations(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.echemi(requestId) })
      // Collected offers are supplier responses like any other, so the card's
      // own comparison is what actually changed.
      queryClient.invalidateQueries({ queryKey: procurementKeys.card(requestId) })
      queryClient.invalidateQueries({ queryKey: [...procurementKeys.all, 'responses'] })
    },
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

  const cardTarget = query.data?.target
  useEffect(() => {
    // Seed once from the card, then leave the specialist's own edits alone.
    if (cardTarget) setDelivery(current => current.quantity ? current : initialEchemiDelivery(cardTarget))
  }, [cardTarget])

  const eligible = useMemo(() => query.data?.search.results.filter(item => item.eligible_for_inquiry) || [], [query.data])
  useEffect(() => {
    if (selectedProductId && !eligible.some(item => item.product_id === selectedProductId)) setSelectedProductId('')
  }, [eligible, selectedProductId])

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Карточка не найдена" />

  const state = query.data
  const quotations = state.quotations || {}
  const { searchReady, inquiryReady } = echemiReadiness(state.cardStatus, state.rfqStatus)
  const pendingError = search.error || prepare.error || lifecycle.error || registerSeller.error || collectQuotations.error
  const quantityCheck = quantityMatchesCard(state.target, delivery.quantity, delivery.unit)
  // Refusing here costs a click; refusing on the server costs a round trip and
  // an error the specialist has to decode.
  const formValid = selectedProductId && Number(delivery.quantity) > 0 && delivery.destination.trim() && /^[A-Za-z]{2}$/.test(delivery.country.trim()) && quantityCheck.state !== 'DIFFERS' && quantityCheck.state !== 'INVALID'

  return <DetailLayout backTo={`/procurement/requests/${requestId}`} backLabel="К карточке" eyebrow={`Карточка #${state.cardId}`} title="Отправка RFQ через Echemi" status={<StatusBadge status={state.search.status} />} meta={`CAS ${state.casNumber || '—'} · ${state.targetVolume || 'объём не указан'}`} warnings={<>
    <Alert><AlertTriangle /><AlertTitle>Прямое обращение к площадке</AlertTitle><AlertDescription>
      Эта страница обращается к продавцу Echemi напрямую. Поиск и квалификация поставщиков живут на <Link to={`/procurement/requests/${requestId}/sourcing`}>единой странице поиска</Link>, где Echemi — один из движков наравне с Brave, DDGS и OpenSERP.
      Поиск отсюда записывается как обычный прогон, поэтому его результаты видны и на странице поиска.
      Отправка заводит продавца в справочник и создаёт задание, чтобы его ответ было к чему привязать.
    </AlertDescription></Alert>
    {!searchReady && <Alert><AlertTriangle /><AlertTitle>Поиск ещё недоступен</AlertTitle><AlertDescription>Сначала нормализуйте карточку: поиск Echemi выполняется по подтверждённому CAS.</AlertDescription></Alert>}
    {searchReady && !inquiryReady && <Alert><AlertTriangle /><AlertTitle>Можно искать, но нельзя готовить inquiry</AlertTitle><AlertDescription>Поиск кандидатов уже доступен. Для подготовки формы требуется отдельно сформировать и явно согласовать RFQ.</AlertDescription></Alert>}
    {!canOperateEchemi && <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для операций Echemi требуется разрешение ECHEMI_OPERATE.</AlertDescription></Alert>}
    {pendingError && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{pendingError.response?.data?.message || pendingError.message}</AlertDescription></Alert>}
    {operation && <Alert><AlertTriangle /><AlertTitle>{echemiOperationIsError(operation) ? 'Операция остановлена' : operation.humanActionRequired ? 'Требуется ручная проверка' : 'Готово'}</AlertTitle><AlertDescription>{echemiOperationLabel(operation)}{operation.humanActionRequired && <div className="pr-echemi-alert-actions"><a href={state.noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Открыть проверку Echemi</a></div>}</AlertDescription></Alert>}
  </>}>
    <div className="pr-stack">
      {canOperateEchemi && <EchemiBrowserAccess access={browserAccess.data} error={browserAccess.error} loading={browserAccess.isLoading} />}
      <Card><CardHeader><CardTitle>1. Выбор листинга для запроса</CardTitle></CardHeader><CardContent>
        <p className="pr-note">Здесь листинг выбирается только для того, чтобы отправить в него inquiry: площадке нужен конкретный product ID. Поиск и квалификация поставщиков — на <Link to={`/procurement/requests/${requestId}/sourcing`}>единой странице поиска</Link>, где Echemi работает как один из движков наравне с Brave, DDGS и OpenSERP.</p>
        <div className="pr-echemi-toolbar"><DefinitionGrid items={[{ label: 'CAS запроса', value: state.casNumber }, { label: 'Последний поиск', value: state.search.searchedAt ? new Date(state.search.searchedAt).toLocaleString('ru-RU') : 'Не запускался' }]} /><Button isDisabled={!searchReady || !canOperateEchemi || search.isPending} onPress={() => { setOperation(null); search.mutate() }}><Search />{search.isPending ? 'Поиск…' : state.search.status === 'HUMAN_ACTION_REQUIRED' ? 'Повторить после проверки' : 'Найти на Echemi'}</Button></div>
        {state.search.status === 'HUMAN_ACTION_REQUIRED' && <div className="pr-echemi-human"><span>Браузер оставлен открытым на странице проверки.</span><a href={state.noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Пройти проверку вручную</a></div>}
      </CardContent></Card>

      {state.search.status === 'COMPLETED' && <Card><CardHeader><CardTitle>2. Выбор листинга</CardTitle></CardHeader><CardContent>
        {eligible.length === 0 ? <EmptyState title="Безопасных кандидатов не найдено" description="Нельзя подготовить inquiry без точного CAS и однозначных product ID, продавца и URL." /> : <div className="pr-echemi-candidates">{eligible.map(item => <button type="button" className={selectedProductId === item.product_id ? 'is-selected' : ''} key={`${item.product_id}-${item.product_url}`} onClick={() => setSelectedProductId(item.product_id)}>
          <span className="pr-echemi-radio">{selectedProductId === item.product_id && <Check />}</span><span><strong>{item.product_name}</strong><small>{item.seller_name || 'Продавец не указан'} · product_id {item.product_id}</small><small>CAS {item.cas_number} · производитель не проверен</small></span><Badge variant="outline">UNVERIFIED</Badge>
        </button>)}</div>}
        {eligible.length > 0 && <div className="pr-echemi-directory"><h4>Справочник поставщиков</h4><p className="pr-note">Отправка запроса заводит продавца автоматически. До отправки его можно добавить вручную — тогда ответ попадёт в готовую карточку.</p><ul>{eligible.map(item => <li key={`dir-${item.product_id}`}><span>{item.seller_name || 'Продавец не указан'}</span>{item.supplier ? <Link to={`/procurement/suppliers/${item.supplier.id}`}><Building size={13} />{item.supplier.id} · <StatusBadge status={item.supplier.qualificationStatus} compact /></Link> : canWriteSuppliers ? <Button variant="outline" size="sm" isDisabled={registerSeller.isPending} onPress={() => registerSeller.mutate(item.product_id)}><Building size={13} />{registerSeller.isPending && registerSeller.variables === item.product_id ? 'Добавляем…' : 'Добавить в справочник'}</Button> : <small>Нет в справочнике</small>}</li>)}</ul></div>}
      </CardContent></Card>}

      {eligible.length > 0 && <Card><CardHeader><CardTitle>3. Параметры формы Echemi</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (formValid) prepare.mutate() }}>
        <label className="pr-form-field"><span>Количество <b>*</b></span><Input type="number" min="0.000001" step="any" value={delivery.quantity} onChange={event => setDelivery(value => ({ ...value, quantity: event.target.value }))} required aria-describedby="pr-quantity-hint" /><small id="pr-quantity-hint" className={`pr-quantity-hint is-${quantityCheck.state.toLowerCase()}`}>{quantityCheck.state === 'MATCHES' ? (quantityCheck.converted ? `Совпадает с карточкой (${state.target?.volume})` : `Из карточки: ${state.target?.volume}`) : quantityCheck.state === 'DIFFERS' ? `Не совпадает с карточкой (${state.target?.volume}). Разрешён только тот же объём в другой единице — иначе измените карточку и согласуйте новый RFQ.` : quantityCheck.state === 'INVALID' ? 'Укажите положительное количество.' : `Объём в карточке («${state.target?.volume || 'не указан'}») не разобран, значение придётся ввести вручную.`}</small></label>
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

      <Card><CardHeader><CardTitle>Предложения продавцов с Echemi</CardTitle></CardHeader><CardContent>
        <p className="pr-note">Площадка показывает наш запрос всем продавцам, поэтому отвечают и те, кого не было в поиске. Сбор идёт по расписанию сам; кнопка нужна, когда ждать очередного прохода не хочется. Сами предложения читаются там же, где ответы из почты — в <Link to={`/procurement/requests/${requestId}`}>карточке</Link>, вместе со сравнением.</p>
        <div className="pr-echemi-toolbar">
          <DefinitionGrid items={[
            { label: 'Последний сбор', value: quotations.lastCollectedAt ? new Date(quotations.lastCollectedAt).toLocaleString('ru-RU') : 'Не запускался' },
            { label: 'Предложений на площадке', value: quotations.publishedCount ? String(quotations.publishedCount) : '—' },
            { label: 'Заведено в систему', value: quotations.ingestedCount ? String(quotations.ingestedCount) : '—' },
          ]} />
          <Button variant="outline" isDisabled={!canOperateEchemi || collectQuotations.isPending} onPress={() => { setOperation(null); collectQuotations.mutate() }}>
            <Inbox />{collectQuotations.isPending ? 'Собираем…' : 'Собрать предложения'}
          </Button>
        </div>
        {collectQuotations.isPending && <p className="pr-note">Каждое предложение разбирается той же моделью, что и письмо поставщика, поэтому сбор занимает минуты.</p>}
        {collectQuotations.data && <Alert><Check /><AlertTitle>Сбор завершён</AlertTitle><AlertDescription>
          Заведено предложений: {collectQuotations.data.quotationsIngested}. Прочитано запросов: {collectQuotations.data.inquiriesRead}.
          {collectQuotations.data.unmatched?.length > 0 && <div>Не удалось соотнести с карточками: {collectQuotations.data.unmatched.map(item => `${item.productName || item.inquiryId} (${item.casNumber || 'без CAS'})`).join(', ')}. Такие запросы отправлены не из системы или их карточка изменилась — предложения по ним не заводятся, чтобы чужая цена не попала в сравнение.</div>}
          {collectQuotations.data.stalled?.length > 0 && <div>Заведено, но не разобрано: {collectQuotations.data.stalled.length}. Разбор такого предложения прервался, и в сравнение оно не попало — повторный сбор его не восстановит, нужна переобработка ответа.</div>}
          {collectQuotations.data.failures?.length > 0 && <div>Не прочитано: {collectQuotations.data.failures.length}. Следующий проход повторит их.</div>}
        </AlertDescription></Alert>}
        {quotations.inquiries?.length > 0 && <ul className="pr-echemi-quotations">{quotations.inquiries.map(item => <li key={item.inquiryId}>
          <span>{item.inquiryId}</span>
          <small>{item.ingestedCount} из {item.publishedCount ?? '—'} · {item.collectedAt ? new Date(item.collectedAt).toLocaleString('ru-RU') : 'не собиралось'}</small>
        </li>)}</ul>}
      </CardContent></Card>
    </div>
  </DetailLayout>
}
