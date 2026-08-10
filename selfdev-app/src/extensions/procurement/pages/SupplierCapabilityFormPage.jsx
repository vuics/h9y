import React, { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, ArrowLeft, Flask } from '../components/icons'
import { SelectField } from '../components/SelectField'

const initial = { casNumber: '', productName: '', source: 'MANUAL', sourceProductId: '', sourceUrl: '', verificationStatus: 'UNVERIFIED' }

export default function SupplierCapabilityFormPage() {
  const { supplierId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWriteSuppliers, canQualifySuppliers } = useProcurementPermissions()
  const [values, setValues] = useState(initial)
  const valid = useMemo(() => values.casNumber.trim() && values.source.trim(), [values])
  const mutation = useMutation({
    mutationFn: () => procurementApi.addSupplierCapability(supplierId, {
      cas_number: values.casNumber.trim(), product_name: values.productName.trim() || null,
      source: values.source.trim(), source_product_id: values.sourceProductId.trim() || null,
      source_url: values.sourceUrl.trim() || null, verification_status: values.verificationStatus,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.supplier(supplierId) })
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      navigate(`/procurement/suppliers/${supplierId}`, { replace: true })
    },
  })
  if (!canWriteSuppliers) return <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для изменения capabilities требуется SUPPLIER_WRITE.</AlertDescription></Alert>
  const set = key => event => setValues(current => ({ ...current, [key]: event.target.value }))
  const statuses = canQualifySuppliers ? ['UNVERIFIED', 'CLAIMED', 'VERIFIED', 'REJECTED'] : ['UNVERIFIED', 'CLAIMED']
  return <div className="pr-card-form-page">
    <Button variant="ghost" size="sm" onPress={() => navigate(`/procurement/suppliers/${supplierId}`)}><ArrowLeft />К поставщику</Button>
    <div className="pr-section-heading"><div><h2>Новая capability</h2><p>Зафиксируйте заявленный продукт, CAS и источник подтверждения без автоматической квалификации поставщика.</p></div></div>
    {mutation.isError && <Alert><AlertTriangle /><AlertTitle>Capability не сохранена</AlertTitle><AlertDescription>{mutation.error?.response?.data?.message || mutation.error?.message}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Продуктовая возможность</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (valid) mutation.mutate() }}>
      <label className="pr-form-field"><span>CAS-номер <b>*</b></span><Input value={values.casNumber} onChange={set('casNumber')} placeholder="71-43-2" required /></label>
      <label className="pr-form-field"><span>Наименование продукта</span><Input value={values.productName} onChange={set('productName')} placeholder="Торговое или каталожное название" /></label>
      <label className="pr-form-field"><span>Источник <b>*</b></span><Input value={values.source} onChange={set('source')} placeholder="MANUAL, OFFICIAL_CATALOGUE" required /></label>
      <label className="pr-form-field"><span>ID продукта в источнике</span><Input value={values.sourceProductId} onChange={set('sourceProductId')} /></label>
      <label className="pr-form-field pr-form-field--wide"><span>Ссылка на источник</span><Input value={values.sourceUrl} onChange={set('sourceUrl')} placeholder="https://…" /></label>
      <SelectField label="Статус подтверждения" selectedKey={values.verificationStatus} onSelectionChange={value => setValues(current => ({ ...current, verificationStatus: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map(value => <SelectItem key={value} id={value}>{value}</SelectItem>)}</SelectContent></SelectField>
      <div className="pr-form-actions"><Button type="button" variant="outline" onPress={() => navigate(`/procurement/suppliers/${supplierId}`)}>Отмена</Button><Button type="submit" isDisabled={!valid || mutation.isPending}><Flask />{mutation.isPending ? 'Сохранение…' : 'Добавить capability'}</Button></div>
    </form></CardContent></Card>
  </div>
}
