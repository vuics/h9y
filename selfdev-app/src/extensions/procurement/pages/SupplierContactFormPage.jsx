import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, ArrowLeft, MessageSquare } from '../components/icons'
import { SelectField } from '../components/SelectField'

const initial = { channel: 'email', address: '', name: '', role: '', language: '', timezone: '', source: 'MANUAL', verificationStatus: 'UNVERIFIED', active: 'ACTIVE' }
const channels = ['email', 'whatsapp', 'xmpp', 'wechat', 'telegram', 'phone', 'web_form']


export default function SupplierContactFormPage() {
  const { supplierId, contactId } = useParams()
  const editing = Boolean(contactId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWriteSuppliers, canQualifySuppliers } = useProcurementPermissions()
  const [values, setValues] = useState(initial)
  const query = useQuery({ queryKey: procurementKeys.supplier(supplierId), queryFn: ({ signal }) => procurementApi.supplier(supplierId, signal), enabled: editing })
  const contact = query.data?.supplier?.contacts?.find(item => item.id === contactId)

  useEffect(() => {
    if (!contact) return
    setValues({
      channel: contact.channel || 'email', address: contact.address || '', name: contact.name || '', role: contact.role || '',
      language: contact.language || '', timezone: contact.timezone || '', source: contact.source || 'MANUAL',
      verificationStatus: contact.verificationStatus || 'UNVERIFIED', active: contact.active === false ? 'INACTIVE' : 'ACTIVE',
    })
  }, [contact])

  const adapters = useQuery({
    queryKey: procurementKeys.webFormAdapters(),
    queryFn: ({ signal }) => procurementApi.webFormAdapters(signal),
    enabled: values.channel === 'web_form',
  })
  const adapterNames = (adapters.data?.adapters || []).flatMap(item => item.domains).join(' / ')
  const valid = useMemo(() => values.address.trim() && values.channel, [values])
  const mutation = useMutation({
    mutationFn: () => {
      const common = {
        name: values.name.trim() || null, role: values.role.trim() || null, address: values.address.trim(),
        language: values.language.trim() || null, timezone_name: values.timezone.trim() || null,
        ...(canQualifySuppliers ? { verification_status: values.verificationStatus } : {}),
      }
      return editing
        ? procurementApi.updateSupplierContact(supplierId, contactId, { ...common, active: values.active === 'ACTIVE' })
        : procurementApi.addSupplierContact(supplierId, { ...common, channel: values.channel, source: values.source.trim() || 'MANUAL' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.supplier(supplierId) })
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      navigate(`/procurement/suppliers/${supplierId}`, { replace: true })
    },
  })

  if (!canWriteSuppliers) return <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для управления контактами требуется SUPPLIER_WRITE.</AlertDescription></Alert>
  if (editing && query.isLoading) return <LoadingState />
  if (editing && query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (editing && query.data && !contact) return <Alert><AlertTriangle /><AlertTitle>Контакт не найден</AlertTitle><AlertDescription>Контакт не принадлежит этому поставщику или был удалён.</AlertDescription></Alert>

  const set = key => event => setValues(current => ({ ...current, [key]: event.target.value }))
  const verificationStatuses = canQualifySuppliers ? ['UNVERIFIED', 'VERIFIED', 'INVALID'] : [values.verificationStatus]
  return <div className="pr-card-form-page">
    <Button variant="ghost" size="sm" onPress={() => navigate(`/procurement/suppliers/${supplierId}`)}><ArrowLeft />К поставщику</Button>
    <div className="pr-section-heading"><div><h2>{editing ? 'Изменение контакта' : 'Новый контакт'}</h2><p>Адрес нормализуется и проверяется сервером. Дубликат канала и адреса не создаёт новую запись.</p></div></div>
    {mutation.isError && <Alert><AlertTriangle /><AlertTitle>Контакт не сохранён</AlertTitle><AlertDescription>{mutation.error?.response?.data?.message || mutation.error?.message}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Контактные данные</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (valid) mutation.mutate() }}>
      <SelectField label="Канал" required selectedKey={values.channel} isDisabled={editing} onSelectionChange={value => setValues(current => ({ ...current, channel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{channels.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
      {values.channel === 'web_form' && <p className="pr-note pr-form-field--wide">URL — ссылка на страницу товара или форму запроса на сайте поставщика. Сохранить можно только сайт, для которого есть проверенный адаптер{adapterNames ? ` (${adapterNames})` : ''}. Запрос по такому контакту готовится и подтверждается в браузерном контуре, а не рассылается воркером.</p>}
      <label className="pr-form-field"><span>{values.channel === 'web_form' ? 'URL / номер' : 'Адрес / номер'} <b>*</b></span><Input value={values.address} onChange={set('address')} placeholder={values.channel === 'email' ? 'sales@example.com' : values.channel === 'xmpp' ? 'user@domain' : values.channel === 'web_form' ? 'https://www.echemi.com/produce/…' : '+86…'} required /></label>
      <label className="pr-form-field"><span>Имя</span><Input value={values.name} onChange={set('name')} /></label>
      <label className="pr-form-field"><span>Роль</span><Input value={values.role} onChange={set('role')} placeholder="Export manager" /></label>
      <label className="pr-form-field"><span>Язык</span><Input value={values.language} onChange={set('language')} placeholder="ru, en, zh" /></label>
      <label className="pr-form-field"><span>Часовой пояс</span><Input value={values.timezone} onChange={set('timezone')} placeholder="Asia/Shanghai" /></label>
      {!editing && <label className="pr-form-field"><span>Источник</span><Input value={values.source} onChange={set('source')} /></label>}
      <SelectField label="Проверка" selectedKey={values.verificationStatus} isDisabled={!canQualifySuppliers} onSelectionChange={value => setValues(current => ({ ...current, verificationStatus: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{verificationStatuses.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
      {editing && <SelectField label="Активность" selectedKey={values.active} onSelectionChange={value => setValues(current => ({ ...current, active: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem id="ACTIVE">ACTIVE</SelectItem><SelectItem id="INACTIVE">INACTIVE</SelectItem></SelectContent></SelectField>}
      <div className="pr-form-actions"><Button type="button" variant="outline" onPress={() => navigate(`/procurement/suppliers/${supplierId}`)}>Отмена</Button><Button type="submit" isDisabled={!valid || mutation.isPending}><MessageSquare />{mutation.isPending ? 'Сохранение…' : editing ? 'Сохранить контакт' : 'Добавить контакт'}</Button></div>
    </form></CardContent></Card>
  </div>
}
