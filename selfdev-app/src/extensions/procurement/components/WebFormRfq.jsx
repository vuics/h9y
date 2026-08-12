import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { StatusBadge } from './StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, LinkButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from './SelectField'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Check, CircleAlert, ExternalLink, FileCheck, Search } from './icons'
import { EchemiBrowserAccess } from './EchemiBrowserAccess'

const units = ['G', 'KG', 'MG', 'ML', 'L', 'T', 'MT', '20FCL', '40FCL', 'BOU', 'PCS', 'EA', 'GAL', 'KIT']
const incoterms = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP']

const fieldLabels = {
  PRODUCT_NAME: 'Продукт', CAS_NUMBER: 'CAS', QUANTITY: 'Количество', UNIT: 'Единица',
  INCOTERM: 'Базис', DESTINATION: 'Пункт назначения', DESTINATION_COUNTRY: 'Страна',
  MESSAGE: 'Сообщение', EMAIL: 'Email', COMPANY_NAME: 'Компания',
  CONTACT_NAME: 'Контакт', PHONE_COUNTRY: 'Код страны', PHONE_NUMBER: 'Телефон',
}

const capabilityLabels = {
  recipient_selection: 'выбор получателей на форме',
  attachments: 'вложения',
}

const message = mutation => mutation.error?.response?.data?.message || mutation.error?.message

export function WebFormRfq({ negotiationId, cardId, canManage, canQueue, canOperateBrowser, canSubmit }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ quantity: '', unit: 'KG', incoterm: 'CIP', destination: 'Moscow', destinationCountry: 'RU', message: '' })
  const [noVncUrl, setNoVncUrl] = useState('')
  const [confirmSend, setConfirmSend] = useState(false)

  const query = useQuery({
    queryKey: procurementKeys.negotiationWebForm(negotiationId),
    queryFn: ({ signal }) => procurementApi.negotiationWebForm(negotiationId, signal),
  })
  const browserAccess = useQuery({
    queryKey: procurementKeys.echemiBrowserAccess(cardId),
    queryFn: ({ signal }) => procurementApi.echemiBrowserAccess(cardId, signal),
    enabled: Boolean(cardId) && canOperateBrowser,
    retry: false,
  })

  // The backend composes the opener and reads the card quantity, so the panel
  // never re-derives either. The full RFQ is written for email and does not fit
  // a marketplace field.
  const suggestion = query.data?.suggestion
  useEffect(() => {
    if (!suggestion) return
    setForm(current => {
      if (current.touched) return current
      const next = { ...current }
      if (suggestion.quantity != null && !current.quantity) next.quantity = String(suggestion.quantity)
      if (suggestion.unit && units.includes(suggestion.unit)) next.unit = suggestion.unit
      if (suggestion.message && !current.message) next.message = suggestion.message
      return next
    })
  }, [suggestion])
  const accept = data => {
    queryClient.setQueryData(procurementKeys.negotiationWebForm(negotiationId), current => ({ ...(current || {}), request: data.request }))
    if (data.noVncUrl) setNoVncUrl(data.noVncUrl)
  }
  // `touched` is workspace state, not part of the request: the API forbids
  // unknown fields, and sending it turned every preparation into a 422.
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareNegotiationWebForm(negotiationId, {
      quantity: Number(form.quantity),
      unit: form.unit,
      incoterm: form.incoterm,
      destination: form.destination.trim(),
      destinationCountry: form.destinationCountry.trim().toUpperCase(),
      message: form.message.trim(),
    }),
    onSuccess: accept,
  })
  const preview = useMutation({ mutationFn: () => procurementApi.previewNegotiationWebForm(negotiationId), onSuccess: accept })
  const approve = useMutation({ mutationFn: () => procurementApi.approveNegotiationWebForm(negotiationId, request.fingerprint), onSuccess: accept })
  const submit = useMutation({
    mutationFn: () => procurementApi.submitNegotiationWebForm(negotiationId),
    onSuccess: data => { accept(data); setConfirmSend(false) },
  })

  if (query.data && query.data.channel !== 'web_form') return null

  const request = query.data?.request
  const operationError = prepare.error || preview.error || approve.error || submit.error
  // Refusing an over-long message here costs a click; refusing it on the server
  // costs a round trip and an error about a limit the specialist never saw.
  const messageTooLong = Boolean(suggestion?.messageLimit) && form.message.length > suggestion.messageLimit
  const formValid = Number(form.quantity) > 0 && form.destination.trim() && /^[A-Za-z]{2}$/.test(form.destinationCountry) && form.message.trim() && !messageTooLong

  return (
    <Card className="pr-web-form">
      <CardHeader>
        <div>
          <CardTitle>Запрос через форму на сайте</CardTitle>
          <p>Значения готовятся детерминированно, сверяются в живом браузере и подтверждаются вами — модель в поля не пишет.</p>
        </div>
        {request && <StatusBadge status={request.status} />}
      </CardHeader>
      <CardContent>
        {canOperateBrowser && <EchemiBrowserAccess access={browserAccess.data} error={browserAccess.error} loading={browserAccess.isLoading} />}

        {operationError && (
          <Alert><CircleAlert /><AlertTitle>Операция не выполнена</AlertTitle>
            <AlertDescription>{message(prepare.error ? prepare : preview.error ? preview : approve.error ? approve : submit)}</AlertDescription></Alert>
        )}

        {request?.unmappedCapabilities?.length > 0 && (
          <Alert><AlertTriangle /><AlertTitle>Форма размечена не полностью</AlertTitle>
            <AlertDescription>
              Не разобрано: {request.unmappedCapabilities.map(item => capabilityLabels[item] || item).join(', ')}.
              Запрос можно подготовить и проверить в браузере, но отправка заблокирована — иначе одно нажатие
              ушло бы неизвестному числу поставщиков, и ответ было бы не к чему привязать.
            </AlertDescription></Alert>
        )}

        {canManage && (
          <form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (formValid) prepare.mutate() }}>
            <label className="pr-form-field"><span>Количество <b>*</b></span>
              <Input type="number" min="0.000001" step="any" value={form.quantity} onChange={event => setForm(v => ({ ...v, quantity: event.target.value, touched: true }))} required />
              {suggestion?.volume && <small className="pr-quantity-hint">В карточке: {suggestion.volume}{suggestion.quantityParsed ? '' : ' — единица не указана, выберите её сами'}</small>}</label>
            <SelectField label="Единица" selectedKey={form.unit} onSelectionChange={value => setForm(v => ({ ...v, unit: value, touched: true }))}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{units.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
            <SelectField label="Базис" selectedKey={form.incoterm} onSelectionChange={value => setForm(v => ({ ...v, incoterm: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{incoterms.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
            <label className="pr-form-field"><span>Пункт назначения <b>*</b></span>
              <Input value={form.destination} onChange={event => setForm(v => ({ ...v, destination: event.target.value }))} required /></label>
            <label className="pr-form-field"><span>Страна <b>*</b></span>
              <Input value={form.destinationCountry} maxLength={2} onChange={event => setForm(v => ({ ...v, destinationCountry: event.target.value.toUpperCase() }))} required /></label>
            <label className="pr-form-field pr-form-field--wide"><span>Сообщение <b>*</b></span>
              <Textarea value={form.message} onChange={event => setForm(v => ({ ...v, message: event.target.value, touched: true }))} placeholder="Что нужно уточнить: чистота, упаковка, документы, условия оплаты." required />
              <small className={`pr-quantity-hint${suggestion?.messageLimit && form.message.length > suggestion.messageLimit ? ' is-differs' : ''}`}>
                {form.message.length}{suggestion?.messageLimit ? ` / ${suggestion.messageLimit}` : ''} символов · первый запрос короткий намеренно: детали дозапрашиваются в переписке
              </small></label>
            <div className="pr-form-actions">
              <Button type="submit" isDisabled={!formValid || prepare.isPending}>
                <FileCheck />{prepare.isPending ? 'Готовим…' : request ? 'Подготовить заново' : 'Подготовить запрос'}</Button>
            </div>
          </form>
        )}

        {request && (
          <div className="pr-web-form__request">
            <dl>
              <dt>Сайт</dt><dd>{request.adapterId}</dd>
              <dt>Форма</dt><dd><a href={request.formUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} />{request.formUrl}</a></dd>
            </dl>

            <h4>Что будет введено в форму</h4>
            <table className="pr-web-form__values">
              <tbody>{Object.entries(request.values).map(([field, value]) => (
                <tr key={field}><th scope="row">{fieldLabels[field] || field}</th><td>{value}</td></tr>
              ))}</tbody>
            </table>

            {request.mismatches?.length > 0 && (
              <Alert><CircleAlert /><AlertTitle>Браузер показал другие значения</AlertTitle>
                <AlertDescription>Поля с расхождением: {request.mismatches.join(', ')}. Подготовьте запрос заново.</AlertDescription></Alert>
            )}

            <div className="pr-inline-actions">
              {canOperateBrowser && (
                <Button variant="outline" isDisabled={preview.isPending} onPress={() => preview.mutate()}>
                  <Search className={preview.isPending ? 'pr-spin' : undefined} />
                  {preview.isPending ? 'Заполняем форму…' : 'Заполнить и проверить в браузере'}</Button>
              )}
              {canQueue && (
                <Button isDisabled={request.status !== 'PREVIEWED' || approve.isPending} onPress={() => approve.mutate()}>
                  <Check />{approve.isPending ? 'Подтверждаем…' : 'Подтвердить проверенный запрос'}</Button>
              )}
              {noVncUrl && <LinkButton variant="outline" href={noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Открыть браузер</LinkButton>}
            </div>

            {request.status === 'APPROVED' && (
              <div className="pr-web-form__send">
                {request.submissionAllowed && canSubmit
                  ? confirmSend
                    ? <>
                        <Alert><AlertTriangle /><AlertTitle>Отправка необратима</AlertTitle>
                          <AlertDescription>
                            Запрос уйдёт компании «{request.recipientCompany}» на {request.adapterId}.
                            Форма будет заполнена и сверена заново непосредственно перед нажатием.
                          </AlertDescription></Alert>
                        <div className="pr-inline-actions">
                          <Button variant="outline" isDisabled={submit.isPending} onPress={() => setConfirmSend(false)}>Отмена</Button>
                          <Button isDisabled={submit.isPending} onPress={() => submit.mutate()}>
                            {submit.isPending ? 'Отправляем…' : 'Отправить запрос'}</Button>
                        </div>
                      </>
                    : <Button onPress={() => setConfirmSend(true)}>Отправить запрос поставщику</Button>
                  : <Alert><AlertTriangle /><AlertTitle>Подтверждено, но не отправлено</AlertTitle>
                      <AlertDescription>
                        {!request.submissionAllowed
                          ? `Автоматическая отправка для этого сайта выключена. Отправьте проверенную форму вручную через браузер.`
                          : 'Для отправки требуется разрешение ECHEMI_SUBMIT.'}
                      </AlertDescription></Alert>}
              </div>
            )}

            {request.status === 'SUBMITTED' && (
              <Alert><Check /><AlertTitle>Запрос отправлен</AlertTitle>
                <AlertDescription>Получатель: {request.recipientCompany}. Ответ придёт по обычному каналу и попадёт в эту карточку.</AlertDescription></Alert>
            )}
          </div>
        )}

        {!request && !canManage && <p className="pr-note">Запрос ещё не подготовлен. Требуется разрешение NEGOTIATION_MANAGE.</p>}
      </CardContent>
    </Card>
  )
}
