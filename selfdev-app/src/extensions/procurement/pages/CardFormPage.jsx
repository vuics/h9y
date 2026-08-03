import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ArrowLeft } from '../components/icons'

const emptyCard = {
  casNumber: '',
  substanceName: '',
  purity: '',
  applicationArea: '',
  targetVolume: '',
  priceGuideline: '',
  specialistComments: '',
}

const requiredFields = new Set(['casNumber', 'substanceName', 'purity', 'applicationArea', 'targetVolume'])

const fields = [
  ['casNumber', 'CAS-номер', 'Например, 71-43-2', 'text'],
  ['substanceName', 'Наименование вещества', 'Бензол / Benzene', 'text'],
  ['purity', 'Чистота или грейд', 'Например, ≥ 99.9%', 'text'],
  ['applicationArea', 'Область применения', 'Для чего закупается вещество', 'textarea'],
  ['targetVolume', 'Целевой объём', 'Например, 25 KG', 'text'],
  ['priceGuideline', 'Ориентир цены', 'Опционально; не передаётся поставщику без отдельного разрешения', 'text'],
  ['specialistComments', 'Комментарий специалиста', 'Внутренние замечания', 'textarea'],
]

function backendPayload(values) {
  return {
    cas_number: values.casNumber.trim(),
    substance_name: values.substanceName.trim(),
    purity: values.purity.trim(),
    application_area: values.applicationArea.trim(),
    target_volume: values.targetVolume.trim(),
    price_guideline: values.priceGuideline.trim() || null,
    specialist_comments: values.specialistComments.trim() || null,
  }
}

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Не удалось сохранить карточку.'
}

export default function CardFormPage() {
  const { requestId } = useParams()
  const editing = Boolean(requestId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWriteCards } = useProcurementPermissions()
  const [values, setValues] = useState(emptyCard)
  const [serverNotice, setServerNotice] = useState(null)
  const query = useQuery({
    queryKey: procurementKeys.card(requestId),
    queryFn: ({ signal }) => procurementApi.card(requestId, signal),
    enabled: editing,
  })

  useEffect(() => {
    if (!query.data) return
    setValues({
      casNumber: query.data.casNumber || '',
      substanceName: query.data.substanceName || '',
      purity: query.data.purity || '',
      applicationArea: query.data.applicationArea || '',
      targetVolume: query.data.targetVolume || '',
      priceGuideline: query.data.priceGuideline || '',
      specialistComments: query.data.specialistComments || '',
    })
  }, [query.data])

  const valid = useMemo(() => [...requiredFields].every(key => values[key].trim()), [values])
  const mutation = useMutation({
    mutationFn: payload => editing
      ? procurementApi.updateCard(requestId, payload)
      : procurementApi.createCard(payload),
    onSuccess: result => {
      const card = editing ? result.card : result
      queryClient.setQueryData(procurementKeys.card(card.id), card)
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      if (!editing) {
        navigate(`/procurement/requests/${card.id}`, { replace: true })
        return
      }
      const effects = result.effects || {}
      setServerNotice(effects.rfqInvalidated
        ? 'Карточка сохранена. Предыдущий RFQ аннулирован, потому что изменились данные для поставщика.'
        : 'Карточка сохранена.')
    },
  })

  if (!canWriteCards) return <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для создания и изменения карточек требуется разрешение CARD_WRITE.</AlertDescription></Alert>
  if (editing && query.isLoading) return <LoadingState />
  if (editing && query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  const submit = event => {
    event.preventDefault()
    setServerNotice(null)
    if (valid) mutation.mutate(backendPayload(values))
  }

  return <div className="pr-card-form-page">
    <Button variant="ghost" size="sm" onPress={() => navigate(editing ? `/procurement/requests/${requestId}` : '/procurement/requests')}><ArrowLeft />{editing ? 'К карточке' : 'Все карточки'}</Button>
    <div className="pr-section-heading"><div><h2>{editing ? 'Редактирование карточки' : 'Новая карточка закупки'}</h2><p>Эти данные формируют исходное требование и используются в последующих шагах нормализации и RFQ.</p></div></div>
    {editing && query.data?.rfqStatus && <Alert><AlertTriangle /><AlertTitle>Изменение данных поставщику аннулирует RFQ</AlertTitle><AlertDescription>CAS, вещество, чистота, применение и объём входят в RFQ. После их изменения RFQ потребуется сформировать и согласовать заново.</AlertDescription></Alert>}
    {serverNotice && <Alert><AlertTitle>Готово</AlertTitle><AlertDescription>{serverNotice}</AlertDescription></Alert>}
    {mutation.isError && <Alert><AlertTriangle /><AlertTitle>Не удалось сохранить карточку</AlertTitle><AlertDescription>{errorMessage(mutation.error)}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Требования к закупке</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={submit}>
      {fields.map(([key, label, placeholder, type]) => <label key={key} className={type === 'textarea' ? 'pr-form-field pr-form-field--wide' : 'pr-form-field'}><span>{label}{requiredFields.has(key) && <b aria-hidden="true"> *</b>}</span>{type === 'textarea' ? <Textarea value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} required={requiredFields.has(key)} /> : <Input value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} required={requiredFields.has(key)} />}</label>)}
      <div className="pr-form-actions"><Button type="button" variant="outline" onPress={() => navigate(editing ? `/procurement/requests/${requestId}` : '/procurement/requests')}>Отмена</Button><Button type="submit" isDisabled={!valid || mutation.isPending}>{mutation.isPending ? 'Сохранение…' : editing ? 'Сохранить изменения' : 'Создать карточку'}</Button></div>
    </form></CardContent></Card>
  </div>
}
