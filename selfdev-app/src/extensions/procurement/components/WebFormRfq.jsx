import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { StatusBadge } from './StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from './SelectField'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Check, CircleAlert, ExternalLink, FileCheck, Search } from './icons'

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

export function WebFormRfq({ negotiationId, canManage, canQueue, canOperateBrowser }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ quantity: '', unit: 'KG', incoterm: 'CIP', destination: 'Moscow', destinationCountry: 'RU', message: '' })
  const [noVncUrl, setNoVncUrl] = useState('')

  const query = useQuery({
    queryKey: procurementKeys.negotiationWebForm(negotiationId),
    queryFn: ({ signal }) => procurementApi.negotiationWebForm(negotiationId, signal),
  })
  const accept = data => {
    queryClient.setQueryData(procurementKeys.negotiationWebForm(negotiationId), current => ({ ...(current || {}), request: data.request }))
    if (data.noVncUrl) setNoVncUrl(data.noVncUrl)
  }
  const prepare = useMutation({ mutationFn: () => procurementApi.prepareNegotiationWebForm(negotiationId, { ...form, quantity: Number(form.quantity) }), onSuccess: accept })
  const preview = useMutation({ mutationFn: () => procurementApi.previewNegotiationWebForm(negotiationId), onSuccess: accept })
  const approve = useMutation({ mutationFn: () => procurementApi.approveNegotiationWebForm(negotiationId, request.fingerprint), onSuccess: accept })

  if (query.data && query.data.channel !== 'web_form') return null

  const request = query.data?.request
  const operationError = prepare.error || preview.error || approve.error
  const formValid = Number(form.quantity) > 0 && form.destination.trim() && /^[A-Za-z]{2}$/.test(form.destinationCountry) && form.message.trim()

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
        {operationError && (
          <Alert><CircleAlert /><AlertTitle>Операция не выполнена</AlertTitle>
            <AlertDescription>{message(prepare.error ? prepare : preview.error ? preview : approve)}</AlertDescription></Alert>
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
              <Input type="number" min="0.000001" step="any" value={form.quantity} onChange={event => setForm(v => ({ ...v, quantity: event.target.value }))} required /></label>
            <SelectField label="Единица" selectedKey={form.unit} onSelectionChange={value => setForm(v => ({ ...v, unit: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{units.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
            <SelectField label="Базис" selectedKey={form.incoterm} onSelectionChange={value => setForm(v => ({ ...v, incoterm: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{incoterms.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
            <label className="pr-form-field"><span>Пункт назначения <b>*</b></span>
              <Input value={form.destination} onChange={event => setForm(v => ({ ...v, destination: event.target.value }))} required /></label>
            <label className="pr-form-field"><span>Страна <b>*</b></span>
              <Input value={form.destinationCountry} maxLength={2} onChange={event => setForm(v => ({ ...v, destinationCountry: event.target.value.toUpperCase() }))} required /></label>
            <label className="pr-form-field pr-form-field--wide"><span>Сообщение <b>*</b></span>
              <Textarea value={form.message} onChange={event => setForm(v => ({ ...v, message: event.target.value }))} placeholder="Что нужно уточнить: чистота, упаковка, документы, условия оплаты." required /></label>
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
              {noVncUrl && <a className="pr-echemi-browser-link" href={noVncUrl} target="_blank" rel="noreferrer"><ExternalLink />Открыть браузер</a>}
            </div>

            {request.status === 'APPROVED' && (
              <Alert><AlertTriangle /><AlertTitle>Подтверждено, но не отправлено</AlertTitle>
                <AlertDescription>
                  {request.submissionAllowed
                    ? 'Отправка для этого сайта включена.'
                    : 'Автоматическая отправка для этого сайта выключена. Отправьте проверенную форму вручную через браузер.'}
                </AlertDescription></Alert>
            )}
          </div>
        )}

        {!request && !canManage && <p className="pr-note">Запрос ещё не подготовлен. Требуется разрешение NEGOTIATION_MANAGE.</p>}
      </CardContent>
    </Card>
  )
}
