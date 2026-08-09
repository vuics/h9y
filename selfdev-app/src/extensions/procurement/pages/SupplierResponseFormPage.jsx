import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { responseFilesPayload, validateResponseInput } from '../api/responses'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { LoadingState, ErrorState } from '../components/AsyncState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ArrowLeft, FileCheck } from '../components/icons'

export default function SupplierResponseFormPage() {
  const { negotiationId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWriteSupplierResponses } = useProcurementPermissions()
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const query = useQuery({ queryKey: procurementKeys.negotiation(negotiationId), queryFn: ({ signal }) => procurementApi.negotiation(negotiationId, signal) })
  const validation = validateResponseInput(text, files)
  const mutation = useMutation({
    mutationFn: async () => procurementApi.ingestSupplierResponse(negotiationId, {
      response_text: text,
      attachments: await responseFilesPayload(files),
    }),
    onSuccess: proposal => {
      queryClient.setQueryData(procurementKeys.proposal(proposal.id), proposal)
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
      navigate(`/procurement/proposals/${proposal.id}`, { replace: true })
    },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!canWriteSupplierResponses) return <Alert><AlertTriangle /><AlertTitle>Недостаточно прав</AlertTitle><AlertDescription>Для обработки ответа требуется SUPPLIER_RESPONSE_WRITE.</AlertDescription></Alert>
  const negotiation = query.data
  const error = mutation.error?.response?.data?.message || mutation.error?.message

  return <div className="pr-card-form-page"><Button variant="ghost" size="sm" onPress={() => navigate(`/procurement/negotiations/${negotiationId}`)}><ArrowLeft />К переговорам</Button>
    <div className="pr-section-heading"><div><h2>Обработать ответ поставщика</h2><p>{negotiation?.supplierName} · {negotiation?.cardTitle}. Текст и распознанные вложения станут новой ревизией предложения.</p></div></div>
    {mutation.isError && <Alert><AlertTriangle /><AlertTitle>Ответ не обработан</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <Alert><FileCheck /><AlertTitle>Источник сохраняется как evidence</AlertTitle><AlertDescription>Извлечение может занять до двух минут. Интерфейс не вычисляет условия и не помечает заявленный документ полученным без фактического файла.</AlertDescription></Alert>
    <Card><CardHeader><CardTitle>Ответ и вложения</CardTitle></CardHeader><CardContent><form className="pr-card-form" onSubmit={event => { event.preventDefault(); if (!validation) mutation.mutate() }}>
      <label className="pr-form-field pr-form-field--wide"><span>Текст ответа поставщика</span><Textarea value={text} onChange={event => setText(event.target.value)} rows={10} placeholder="Вставьте исходный текст письма или сообщения без пересказа…" /></label>
      <label className="pr-form-field pr-form-field--wide"><span>Вложения PDF, изображения, таблицы или Office-документы</span><Input type="file" multiple onChange={event => setFiles(Array.from(event.target.files || []))} /><small>До 5 файлов, 10 МБ на файл и 20 МБ суммарно. Файлы сохраняются и распознаются на backend.</small></label>
      {files.length > 0 && <div className="pr-upload-list pr-form-field--wide">{files.map(file => <div key={`${file.name}-${file.size}`}><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} КБ · {file.type || 'тип будет определён backend'}</span></div>)}</div>}
      {validation && <p className="pr-form-error pr-form-field--wide">{validation}</p>}
      <div className="pr-form-actions"><Button type="button" variant="outline" onPress={() => navigate(`/procurement/negotiations/${negotiationId}`)}>Отмена</Button><Button type="submit" isDisabled={Boolean(validation) || mutation.isPending}><FileCheck />{mutation.isPending ? 'Распознавание и извлечение…' : 'Обработать ответ'}</Button></div>
    </form></CardContent></Card>
  </div>
}
