import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { StatusBadge, statusLabel } from '../components/StatusBadge'
import { CardIdentity } from '../components/CardIdentity'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '../api/responses'
import { ArrowLeft, CircleAlert, ExternalLink, FileCheck, Refresh } from '../components/icons'
import { siteHostLabel } from '../lib/supplierWeb'
import { formatPrice } from '../lib/price'
import { comparisonColumns, lookupsBySupplier, siteDocumentsCell, siteGradeCell, siteLookupsInProgress, siteSearchText, siteWaterCell } from '../lib/siteGrade'

const comparisonFields = [
  ['price', 'Цена', formatPrice],
  ['quantity', 'Количество', row => row.quantity], ['moq', 'MOQ', row => row.moq],
  ['basis', 'Базис поставки', row => row.incoterm ? `${row.incoterm} ${row.namedPlace || ''}` : null, row => row.incoterm],
  ['grade', 'Грейд', row => row.grade], ['purity', 'Чистота', row => row.purity],
  ['leadTime', 'Срок поставки', row => row.leadTime], ['paymentTerms', 'Условия оплаты', row => row.paymentTerms],
  ['coa', 'CoA', row => <StatusBadge status={row.coa} />, row => row.coa], ['tds', 'TDS', row => <StatusBadge status={row.tds} />, row => row.tds],
  ['sampleAvailable', 'Образец', row => row.sampleAvailable], ['completeness', 'Готовность', row => <StatusBadge status={row.completeness} />, row => row.completeness],
]

// Read from the supplier's own website, never from its reply, and so kept in
// rows of their own right under the reply's grade: the two must not be read
// as one value. Each cell says «с сайта» and links the page it came from.
const siteFields = [
  ['siteGrade', 'Грейд с сайта', siteGradeCell],
  ['siteWater', 'Вода, по сайту', siteWaterCell],
  ['siteDocuments', 'Документы на сайте', siteDocumentsCell],
]

// The API's `decisionNote` is English and is also what the CSV EN export states;
// the page is Russian, so it says the same thing in its own words.
const DECISION_NOTE = 'Сравнение только показывает условия: оно не ранжирует поставщиков и не выбирает победителя. Решение принимает специалист по закупкам.'

const fieldState = (row, key, raw) => row.fieldStates?.[key] || (raw ? 'PRESENT' : 'UNKNOWN')
// Mirrored server-side in `comparison_row_matches` and `comparison_export` so the
// CSV export contains exactly the rows shown here, the site grade included.
const matchesSearch = (row, search, lookup) => !search || [row.supplierName, row.incoterm, row.namedPlace, row.currency, row.grade, row.proposalId, row.id, siteSearchText(lookup)].some(value => String(value ?? '').toLowerCase().includes(search))

function SiteCell({ cell }) {
  if (!cell.found) return <><strong>{cell.text}</strong>{cell.reason && <small>{cell.reason}</small>}</>
  const link = cell.sourceUrl || cell.links?.[0]?.url
  return <>
    <span className="pr-site-mark">с сайта</span>
    <strong>{cell.links?.length ? cell.links.map((item, index) => <React.Fragment key={item.url}>{index > 0 && ', '}<a href={item.url} target="_blank" rel="noreferrer">{item.label}</a></React.Fragment>) : cell.text}</strong>
    {cell.grades?.[0]?.quote && <small title={cell.grades.map(item => item.quote).join('\n')}>«{cell.grades[0].quote}»</small>}
    {cell.quote && <small>«{cell.quote}»</small>}
    {link && !cell.links?.length && <a className="pr-comparison__site" href={link} target="_blank" rel="noreferrer" title={link}><ExternalLink size={12} />{siteHostLabel(link)}{cell.checkedAt ? ` · ${cell.checkedAt}` : ''}</a>}
  </>
}

export default function ProposalComparisonPage() {
  const [filters, setFilters] = useUrlFilters({ onlyFilled: '' })
  const cardId = filters.cardId
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: procurementKeys.comparison(cardId),
    queryFn: ({ signal }) => procurementApi.comparison(cardId, signal),
    enabled: Boolean(cardId),
    // Sites are read in the background after the table first opens; poll only
    // while one is still being read, then stop.
    refetchInterval: data => (siteLookupsInProgress(data) ? 5000 : false),
  })
  const exportCsv = useMutation({
    mutationFn: language => procurementApi.exportSupplierComparison(cardId, language, { search: filters.search, status: filters.status }),
    onSuccess: downloadBlob,
  })
  const recheck = useMutation({
    mutationFn: () => procurementApi.recheckSiteGrades(cardId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.comparison(cardId) }),
  })
  if (!cardId) return <EmptyState title="Выберите карточку закупки" description="Откройте предложения нужной карточки и запустите сравнение оттуда." action={<RouterLinkButton to="/procurement/proposals">К предложениям</RouterLinkButton>} />
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const allRows = comparisonColumns(query.data)
  if (!allRows.length) return <EmptyState title="Нет предложений для сравнения" />
  const lookups = lookupsBySupplier(query.data)
  const offers = allRows.filter(row => !row.awaiting)
  const awaitingCount = allRows.length - offers.length
  const search = (filters.search || '').trim().toLowerCase()
  // A supplier that has not answered has no readiness to filter on, so a
  // status filter shows offers only.
  const rows = allRows.filter(row => matchesSearch(row, search, lookups.get(row.supplierId)) && (!filters.status || (!row.awaiting && row.completeness === filters.status)))
  const statuses = [...new Set(offers.map(row => row.completeness).filter(Boolean))].map(status => ({ value: status, label: statusLabel(status) }))
  const onlyFilled = filters.onlyFilled === '1'
  const fields = comparisonFields.filter(([key, , format, raw]) => !onlyFilled || rows.some(row => !row.awaiting && fieldState(row, key, (raw || format)(row)) !== 'UNKNOWN'))
  const shownSiteFields = query.data.siteLookups?.length
    ? siteFields.filter(([, , cell]) => !onlyFilled || rows.some(row => cell(lookups.get(row.supplierId)).found))
    : []
  const gradeIndex = fields.findIndex(([key]) => key === 'grade')
  const tableFields = [
    ...fields.slice(0, gradeIndex + 1).map(field => ['offer', field]),
    ...shownSiteFields.map(field => ['site', field]),
    ...fields.slice(gradeIndex + 1).map(field => ['offer', field]),
  ]
  const checking = siteLookupsInProgress(query.data)
  return <div className="pr-stack"><RouterLinkButton to={`/procurement/proposals?cardId=${cardId}`} variant="ghost" size="sm"><ArrowLeft size={15} />Предложения карточки #{cardId}</RouterLinkButton><div className="pr-section-heading"><div><h2>Сравнение предложений</h2><p>Условия из ответов поставщиков, приведённые к единому виду. Валюты не пересчитываются, поставщики не ранжируются.</p><CardIdentity cardId={cardId} /></div><div className="pr-inline-actions">{query.data.siteLookups?.length > 0 && <Button variant="outline" isDisabled={recheck.isPending || checking} onPress={() => recheck.mutate()}><Refresh />{checking ? 'Проверяем сайты…' : 'Проверить сайты заново'}</Button>}<Button variant="outline" isDisabled={exportCsv.isPending} onPress={() => exportCsv.mutate('ru')}><FileCheck />CSV RU</Button><Button variant="outline" isDisabled={exportCsv.isPending} onPress={() => exportCsv.mutate('en')}><FileCheck />CSV EN</Button></div></div>{exportCsv.isError && <Alert><CircleAlert /><AlertTitle>Экспорт не выполнен</AlertTitle><AlertDescription>{exportCsv.error?.response?.data?.message || exportCsv.error?.message}</AlertDescription></Alert>}{recheck.isError && <Alert><CircleAlert /><AlertTitle>Проверку сайтов не удалось запустить</AlertTitle><AlertDescription>{recheck.error?.response?.data?.message || recheck.error?.message}</AlertDescription></Alert>}<Alert><CircleAlert /><AlertTitle>Решение остаётся за специалистом</AlertTitle><AlertDescription>{DECISION_NOTE}</AlertDescription></Alert>
    <ListFilters filters={filters} onChange={setFilters} statuses={statuses} placeholder="Поставщик, валюта, Incoterm или RESP-ID"><Button variant={onlyFilled ? 'default' : 'outline'} onPress={() => setFilters({ onlyFilled: onlyFilled ? '' : '1' })}>Только заполненные параметры</Button></ListFilters>
    <p className="pr-note">Показано {rows.length} из {allRows.length} поставщиков{awaitingCount > 0 ? ` (из них ${awaitingCount} ещё не ответили)` : ''} · {fields.length} из {comparisonFields.length} параметров · таблица прокручивается по горизонтали, столбец параметров закреплён. Экспорт CSV повторяет поиск и статус; набор колонок в файле полный и не зависит от переключателя параметров.</p>
    {shownSiteFields.length > 0 && <p className="pr-note">Строки «с сайта» — то, что поставщик пишет о продукте на своём сайте, для тех, кому уже ушёл запрос. Это не его предложение: грейд из ответа поставщика стоит строкой выше и важнее. Сайт каждого поставщика читается один раз; «нет данных» — если на сайте этого нет.</p>}
    {!rows.length ? <EmptyState title="Под фильтры ничего не подошло" description="Измените поиск или статус готовности." /> : <div className="pr-comparison-wrap"><table className="pr-comparison"><thead><tr><th>Параметр</th>{rows.map(row => <th key={row.rowKey || row.id}>{row.awaiting ? <Link to={`/procurement/negotiations/${row.negotiationId}`}>{row.supplierName}</Link> : <Link to={`/procurement/proposals/${row.proposalId || row.id}`}>{row.supplierName}</Link>}{row.supplierWebsite && <a className="pr-comparison__site" href={row.supplierWebsite} target="_blank" rel="noreferrer" title={row.supplierWebsite}><ExternalLink size={12} />{siteHostLabel(row.supplierWebsite)}</a>}{row.awaiting ? <StatusBadge status="WAITING_SUPPLIER" label="Ответа ещё нет" tone="muted" compact /> : <StatusBadge status={row.completeness} compact />}</th>)}</tr></thead><tbody>{tableFields.map(([kind, [key, label, format, raw]]) => <tr key={key} className={kind === 'site' ? 'pr-comparison__site-row' : undefined}><th>{label}</th>{rows.map(row => {
      if (kind === 'site') {
        const cell = format(lookups.get(row.supplierId))
        return <td key={row.rowKey || row.id} className={cell.found ? 'pr-comparison__site-found' : 'pr-comparison__unknown'}><SiteCell cell={cell} /></td>
      }
      if (row.awaiting) return <td key={row.rowKey || row.id} className="pr-comparison__unknown"><strong>{key === 'price' ? 'Ждём ответа' : '—'}</strong></td>
      const value = format(row); const state = fieldState(row, key, (raw || format)(row)); return <td key={row.rowKey || row.id} className={`pr-comparison__${state.toLowerCase()}`}>{React.isValidElement(value) ? value : <><strong>{value || 'Нет данных'}</strong><StatusBadge status={state} compact />{row.originalValues?.[key] && <small>Исходно: {row.originalValues[key]}</small>}</>}</td>
    })}</tr>)}</tbody></table></div>}
  </div>
}
