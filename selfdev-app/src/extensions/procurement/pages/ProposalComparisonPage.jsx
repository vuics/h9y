import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { ArrowLeft, CircleAlert } from '../components/icons'

const comparisonFields = [
  ['price', 'Цена', row => row.price ? `${row.price} ${row.currency}/${row.priceUnit}` : null],
  ['quantity', 'Количество', row => row.quantity], ['moq', 'MOQ', row => row.moq],
  ['basis', 'Базис поставки', row => row.incoterm ? `${row.incoterm} ${row.namedPlace || ''}` : null],
  ['grade', 'Грейд', row => row.grade], ['purity', 'Чистота', row => row.purity],
  ['leadTime', 'Срок поставки', row => row.leadTime], ['paymentTerms', 'Условия оплаты', row => row.paymentTerms],
  ['coa', 'CoA', row => <StatusBadge status={row.coa} />], ['tds', 'TDS', row => <StatusBadge status={row.tds} />],
  ['sampleAvailable', 'Образец', row => row.sampleAvailable], ['completeness', 'Готовность', row => <StatusBadge status={row.completeness} />],
]

export default function ProposalComparisonPage() {
  const [params] = useSearchParams()
  const cardId = params.get('cardId')
  const query = useQuery({ queryKey: procurementKeys.comparison(cardId), queryFn: ({ signal }) => procurementApi.comparison(cardId, signal), enabled: Boolean(cardId) })
  if (!cardId) return <EmptyState title="Выберите карточку закупки" description="Откройте предложения нужной карточки и запустите сравнение оттуда." action={<Button render={<Link to="/procurement/proposals" />}>К предложениям</Button>} />
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data?.rows?.length) return <EmptyState title="Нет предложений для сравнения" />
  const rows = query.data.rows
  return <div className="pr-stack"><Button render={<Link to={`/procurement/proposals?cardId=${cardId}`} />} variant="ghost" size="sm"><ArrowLeft size={15} />Предложения карточки #{cardId}</Button><div className="pr-section-heading"><div><h2>Сравнение предложений</h2><p>Только нормализованные backend-данные; интерфейс не пересчитывает валюты и не ранжирует поставщиков.</p></div></div><Alert><CircleAlert /><AlertTitle>Решение остаётся за специалистом</AlertTitle><AlertDescription>{query.data.decisionNote}</AlertDescription></Alert>
    <div className="pr-comparison-wrap"><table className="pr-comparison"><thead><tr><th>Параметр</th>{rows.map(row => <th key={row.rowKey || row.id}><Link to={`/procurement/proposals/${row.proposalId || row.id}`}>{row.supplierName}</Link><StatusBadge status={row.completeness} compact /></th>)}</tr></thead><tbody>{comparisonFields.map(([key, label, format]) => <tr key={key}><th>{label}</th>{rows.map(row => { const value = format(row); const fieldState = row.fieldStates?.[key] || (value ? 'PRESENT' : 'UNKNOWN'); return <td key={row.rowKey || row.id} className={`pr-comparison__${fieldState.toLowerCase()}`}>{React.isValidElement(value) ? value : <><strong>{value || 'Нет данных'}</strong><StatusBadge status={fieldState} compact />{row.originalValues?.[key] && <small>Исходно: {row.originalValues[key]}</small>}</>}</td>})}</tr>)}</tbody></table></div>
  </div>
}
