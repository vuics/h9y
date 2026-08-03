import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from '../components/icons'

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
  const query = useQuery({ queryKey: procurementKeys.proposal(proposalId), queryFn: ({ signal }) => procurementApi.proposal(proposalId, signal) })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Предложение не найдено" />
  const proposal = query.data
  return <DetailLayout backTo="/procurement/proposals" backLabel="Все предложения" eyebrow={`${proposal.id} · ревизия ${proposal.revision}`} title={proposal.supplierName} status={<StatusBadge status={proposal.completeness} />} meta={<><Link to={`/procurement/requests/${proposal.cardId}`}>Карточка #{proposal.cardId}</Link> · Идентичность: <StatusBadge status={proposal.productIdentityStatus === 'UNVERIFIED' ? 'UNVERIFIED_IDENTITY' : proposal.productIdentityStatus} compact /></>} warnings={proposal.warnings?.length > 0 && <Alert><AlertTriangle /><AlertTitle>Предложение нельзя считать полностью готовым</AlertTitle><AlertDescription><ul>{proposal.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}>
    <Card><CardHeader><CardTitle>Коммерческие условия</CardTitle><CardAction><Link to={`/procurement/proposals/compare?cardId=${proposal.cardId}`}>Сравнить по карточке</Link></CardAction></CardHeader><CardContent><div className="pr-field-grid">{fields.map(([key, label, format]) => { const value = format(proposal); const state = proposal.fieldStates?.[key] || (value ? 'PRESENT' : 'UNKNOWN'); return <div className={`pr-field pr-field--${state.toLowerCase()}`} key={key}><div><span>{label}</span><StatusBadge status={state} compact /></div><strong>{value || 'Не указано'}</strong>{proposal.originalValues?.[key] && <small>Исходное значение: {proposal.originalValues[key]}</small>}</div> })}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Документы</CardTitle></CardHeader><CardContent><div className="pr-documents"><div><strong>CoA</strong><StatusBadge status={proposal.coa} /></div><div><strong>TDS</strong><StatusBadge status={proposal.tds} /></div><div><strong>SDS</strong><StatusBadge status={proposal.sds} /></div></div><p className="pr-note">«Заявлен во вложении» не означает, что документ успешно получен и проверен.</p></CardContent></Card>
  </DetailLayout>
}
