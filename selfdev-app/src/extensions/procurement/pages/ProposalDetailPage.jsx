import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ExternalLink, MessageSquare } from '../components/icons'

const fields = [
  ['price', 'Цена', value => value.price ? `${value.price} ${value.currency}/${value.priceUnit}` : null],
  ['quantity', 'Количество', value => value.quantity], ['moq', 'MOQ', value => value.moq],
  ['incoterm', 'Базис поставки', value => value.incoterm ? `${value.incoterm} ${value.namedPlace || ''}` : null],
  ['leadTime', 'Срок поставки', value => value.leadTime], ['paymentTerms', 'Условия оплаты', value => value.paymentTerms],
  ['grade', 'Грейд', value => value.grade], ['purity', 'Чистота', value => value.purity],
  ['sampleAvailable', 'Образец', value => value.sampleAvailable],
]

export default function ProposalDetailPage() {
  const { proposalId } = useParams()
  const { canReadCommunications, canWriteSupplierResponses } = useProcurementPermissions()
  const [clarification, setClarification] = useState(null)
  const query = useQuery({ queryKey: procurementKeys.proposal(proposalId), queryFn: ({ signal }) => procurementApi.proposal(proposalId, signal) })
  const clarify = useMutation({
    mutationFn: language => procurementApi.prepareSupplierClarification(proposalId, language),
    onSuccess: setClarification,
  })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Предложение не найдено" />
  const proposal = query.data
  const clarificationError = clarify.error?.response?.data?.message || clarify.error?.message
  const actions = proposal.negotiationId && canWriteSupplierResponses ? <RouterLinkButton to={`/procurement/negotiations/${proposal.negotiationId}/responses/new`}><MessageSquare />Добавить ответ</RouterLinkButton> : null
  return <DetailLayout backTo="/procurement/proposals" backLabel="Все предложения" eyebrow={`${proposal.id} · ревизия ${proposal.revision}`} title={proposal.supplierName} status={<StatusBadge status={proposal.completeness} />} meta={<><Link to={`/procurement/requests/${proposal.cardId}`}>Карточка #{proposal.cardId}</Link> · Идентичность: <StatusBadge status={proposal.productIdentityStatus === 'UNVERIFIED' ? 'UNVERIFIED_IDENTITY' : proposal.productIdentityStatus} compact /></>} actions={actions} warnings={<>{proposal.warnings?.length > 0 && <Alert><AlertTriangle /><AlertTitle>Предложение нельзя считать полностью готовым</AlertTitle><AlertDescription><ul>{proposal.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}{clarify.isError && <Alert><AlertTriangle /><AlertTitle>Уточнение не подготовлено</AlertTitle><AlertDescription>{clarificationError}</AlertDescription></Alert>}</>}>
    <Card><CardHeader><CardTitle>Коммерческие условия</CardTitle><CardAction><Link to={`/procurement/proposals/compare?cardId=${proposal.cardId}`}>Сравнить по карточке</Link></CardAction></CardHeader><CardContent><div className="pr-field-grid">{fields.map(([key, label, format]) => { const value = format(proposal); const state = proposal.fieldStates?.[key] || (value ? 'PRESENT' : 'UNKNOWN'); return <div className={`pr-field pr-field--${state.toLowerCase()}`} key={key}><div><span>{label}</span><StatusBadge status={state} compact /></div><strong>{value || 'Не указано'}</strong>{proposal.originalValues?.[key] && <small>Исходное значение: {proposal.originalValues[key]}</small>}</div> })}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Документы</CardTitle></CardHeader><CardContent><div className="pr-documents"><div><strong>CoA</strong><StatusBadge status={proposal.coa} /></div><div><strong>TDS</strong><StatusBadge status={proposal.tds} /></div><div><strong>SDS</strong><StatusBadge status={proposal.sds} /></div></div><p className="pr-note">«Заявлен во вложении» не означает, что документ успешно получен и проверен. PROVIDED появляется только после обработки фактического файла.</p>{proposal.attachments?.length > 0 && <div className="pr-attachment-list">{proposal.attachments.map(item => <a key={item.id} href={procurementApi.supplierAttachmentUrl(item.id)} target="_blank" rel="noreferrer"><div><strong>{item.filename}</strong><span>{(item.size / 1024).toFixed(1)} КБ · {item.contentType}</span></div><StatusBadge status={item.status} compact /><ExternalLink size={14} /></a>)}</div>}</CardContent></Card>
    {canReadCommunications && <Card><CardHeader><CardTitle>Уточнение поставщику</CardTitle><CardAction><div className="pr-inline-actions"><Button variant="outline" size="sm" isDisabled={clarify.isPending} onPress={() => clarify.mutate('ru')}>Подготовить RU</Button><Button variant="outline" size="sm" isDisabled={clarify.isPending} onPress={() => clarify.mutate('en')}>Подготовить EN</Button></div></CardAction></CardHeader><CardContent>{clarification ? <><p className="pr-note">Черновик построен backend только по сохранённым пробелам. Он не сохранён и не отправлен.</p><Textarea value={clarification.draft} readOnly rows={12} /><div className="pr-inline-actions"><Button size="sm" onPress={() => navigator.clipboard.writeText(clarification.draft)}>Копировать</Button><StatusBadge status={clarification.language.toUpperCase()} compact /></div></> : <p className="pr-note">Подготовьте RU- или EN-черновик. Отправка остаётся отдельным действием в существующем чате/канале переговоров.</p>}</CardContent></Card>}
    <Card><CardHeader><CardTitle>Источники</CardTitle></CardHeader><CardContent className="pr-source-references">{proposal.sourceReferences?.map(source => <div key={source.sourceId}><div><strong>{source.sourceId}</strong><span>{source.channel} · {source.receivedAt ? new Date(source.receivedAt).toLocaleString('ru-RU') : '—'}</span></div><code>{source.sha256}</code></div>)}</CardContent></Card>
  </DetailLayout>
}
