import React, { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, ArrowLeft, Building } from '../components/icons'

const initial = { canonicalName: '', country: '', source: 'MANUAL', sourceIdentity: '' }

const errorMessage = error => error?.response?.data?.message || error?.message || 'Не удалось зарегистрировать поставщика.'

export default function SupplierFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWriteSuppliers } = useProcurementPermissions()
  const [values, setValues] = useState(initial)
  const valid = useMemo(() => values.canonicalName.trim() && values.source.trim(), [values])
  const mutation = useMutation({
    mutationFn: () => procurementApi.createSupplier({
      canonical_name: values.canonicalName.trim(),
      country: values.country.trim() || null,
      source: values.source.trim(),
      source_identity: values.sourceIdentity.trim() || null,
    }),
    onSuccess: supplier => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      navigate(`/procurement/suppliers/${supplier.id}`, { replace: true })
    },
  })

  if (!canWriteSuppliers) return <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для регистрации поставщика требуется разрешение SUPPLIER_WRITE.</AlertDescription></Alert>

  const set = key => event => setValues(current => ({ ...current, [key]: event.target.value }))
  const submit = event => { event.preventDefault(); if (valid) mutation.mutate() }

  return <div className="pr-card-form-page">
    <Button variant="ghost" size="sm" onPress={() => navigate('/procurement/suppliers')}><ArrowLeft />Все поставщики</Button>
    <div className="pr-section-heading"><div><h2>Регистрация поставщика</h2><p>Создайте устойчивую запись поставщика. Продукты и контакты добавляются после регистрации с указанием источников.</p></div></div>
    {mutation.isError && <Alert><AlertTriangle /><AlertTitle>Регистрация не выполнена</AlertTitle><AlertDescription>{errorMessage(mutation.error)}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Идентификация поставщика</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={submit}>
      <label className="pr-form-field"><span>Наименование компании <b>*</b></span><Input value={values.canonicalName} onChange={set('canonicalName')} placeholder="Например, Qingdao Nova Chemical Co." required /></label>
      <label className="pr-form-field"><span>Страна</span><Input value={values.country} onChange={set('country')} placeholder="Код или название страны" /></label>
      <label className="pr-form-field"><span>Источник <b>*</b></span><Input value={values.source} onChange={set('source')} placeholder="MANUAL, OFFICIAL_CATALOGUE, WEBSITE" required /></label>
      <label className="pr-form-field"><span>Идентификатор в источнике</span><Input value={values.sourceIdentity} onChange={set('sourceIdentity')} placeholder="URL, ID профиля или точное имя" /></label>
      <div className="pr-form-actions"><Button type="button" variant="outline" onPress={() => navigate('/procurement/suppliers')}>Отмена</Button><Button type="submit" isDisabled={!valid || mutation.isPending}><Building />{mutation.isPending ? 'Регистрация…' : 'Зарегистрировать'}</Button></div>
    </form></CardContent></Card>
  </div>
}
