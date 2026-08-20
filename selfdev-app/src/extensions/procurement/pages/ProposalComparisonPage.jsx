import React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { StatusBadge, statusLabel } from '../components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '../api/responses'
import { ArrowLeft, CircleAlert, FileCheck } from '../components/icons'

const comparisonFields = [
  ['price', 'Цена', row => row.price ? `${row.price} ${row.currency}/${row.priceUnit}` : null],
  ['quantity', 'Количество', row => row.quantity], ['moq', 'MOQ', row => row.moq],
  ['basis', 'Базис поставки', row => row.incoterm ? `${row.incoterm} ${row.namedPlace || ''}` : null, row => row.incoterm],
  ['grade', 'Грейд', row => row.grade], ['purity', 'Чистота', row => row.purity],
  ['leadTime', 'Срок поставки', row => row.leadTime], ['paymentTerms', 'Условия оплаты', row => row.paymentTerms],
  ['coa', 'CoA', row => <StatusBadge status={row.coa} />, row => row.coa], ['tds', 'TDS', row => <StatusBadge status={row.tds} />, row => row.tds],
  ['sampleAvailable', 'Образец', row => row.sampleAvailable], ['completeness', 'Готовность', row => <StatusBadge status={row.completeness} />, row => row.completeness],
]

const fieldState = (row, key, raw) => row.fieldStates?.[key] || (raw ? 'PRESENT' : 'UNKNOWN')
// Mirrored server-side in `comparison_row_matches` so the CSV export contains
// exactly the rows shown here.
const matchesSearch = (row, search) => !search || [row.supplierName, row.incoterm, row.namedPlace, row.currency, row.grade, row.proposalId, row.id].some(value => String(value ?? '').toLowerCase().includes(search))

export default function ProposalComparisonPage() {
  const [filters, setFilters] = useUrlFilters({ onlyFilled: '' })
  const cardId = filters.cardId
  const query = useQuery({ queryKey: procurementKeys.comparison(cardId), queryFn: ({ signal }) => procurementApi.comparison(cardId, signal), enabled: Boolean(cardId) })
  const exportCsv = useMutation({
    mutationFn: language => procurementApi.exportSupplierComparison(cardId, language, { search: filters.search, status: filters.status }),
    onSuccess: downloadBlob,
  })
  if (!cardId) return <EmptyState title="Выберите карточку закупки" description="Откройте предложения нужной карточки и запустите сравнение оттуда." action={<RouterLinkButton to="/procurement/proposals">К предложениям</RouterLinkButton>} />
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data?.rows?.length) return <EmptyState title="Нет предложений для сравнения" />
  const allRows = query.data.rows
  const search = (filters.search || '').trim().toLowerCase()
  const rows = allRows.filter(row => matchesSearch(row, search) && (!filters.status || row.completeness === filters.status))
  const statuses = [...new Set(allRows.map(row => row.completeness).filter(Boolean))].map(status => ({ value: status, label: statusLabel(status) }))
  const onlyFilled = filters.onlyFilled === '1'
  const fields = comparisonFields.filter(([key, , format, raw]) => !onlyFilled || rows.some(row => fieldState(row, key, (raw || format)(row)) !== 'UNKNOWN'))
  return <div className="pr-stack"><RouterLinkButton to={`/procurement/proposals?cardId=${cardId}`} variant="ghost" size="sm"><ArrowLeft size={15} />Предложения карточки #{cardId}</RouterLinkButton><div className="pr-section-heading"><div><h2>Сравнение предложений</h2><p>Только нормализованные backend-данные; интерфейс не пересчитывает валюты и не ранжирует поставщиков.</p></div><div className="pr-inline-actions"><Button variant="outline" isDisabled={exportCsv.isPending} onPress={() => exportCsv.mutate('ru')}><FileCheck />CSV RU</Button><Button variant="outline" isDisabled={exportCsv.isPending} onPress={() => exportCsv.mutate('en')}><FileCheck />CSV EN</Button></div></div>{exportCsv.isError && <Alert><CircleAlert /><AlertTitle>Экспорт не выполнен</AlertTitle><AlertDescription>{exportCsv.error?.response?.data?.message || exportCsv.error?.message}</AlertDescription></Alert>}<Alert><CircleAlert /><AlertTitle>Решение остаётся за специалистом</AlertTitle><AlertDescription>{query.data.decisionNote}</AlertDescription></Alert>
    <ListFilters filters={filters} onChange={setFilters} statuses={statuses} placeholder="Поставщик, валюта, Incoterm или RESP-ID"><Button variant={onlyFilled ? 'default' : 'outline'} onPress={() => setFilters({ onlyFilled: onlyFilled ? '' : '1' })}>Только заполненные параметры</Button></ListFilters>
    <p className="pr-note">Показано {rows.length} из {allRows.length} предложений · {fields.length} из {comparisonFields.length} параметров · таблица прокручивается по горизонтали, столбец параметров закреплён. Экспорт CSV повторяет поиск и статус; набор колонок в файле полный и не зависит от переключателя параметров.</p>
    {!rows.length ? <EmptyState title="Под фильтры ничего не подошло" description="Измените поиск или статус готовности." /> : <div className="pr-comparison-wrap"><table className="pr-comparison"><thead><tr><th>Параметр</th>{rows.map(row => <th key={row.rowKey || row.id}><Link to={`/procurement/proposals/${row.proposalId || row.id}`}>{row.supplierName}</Link><StatusBadge status={row.completeness} compact /></th>)}</tr></thead><tbody>{fields.map(([key, label, format, raw]) => <tr key={key}><th>{label}</th>{rows.map(row => { const value = format(row); const state = fieldState(row, key, (raw || format)(row)); return <td key={row.rowKey || row.id} className={`pr-comparison__${state.toLowerCase()}`}>{React.isValidElement(value) ? value : <><strong>{value || 'Нет данных'}</strong><StatusBadge status={state} compact />{row.originalValues?.[key] && <small>Исходно: {row.originalValues[key]}</small>}</>}</td>})}</tr>)}</tbody></table></div>}
  </div>
}
