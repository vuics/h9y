import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { DataTable, Pagination } from '../components/DataTable'
import { ListFilters } from '../components/ListFilters'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { plural } from '../components/SourcingSettings'
import { groupOffersBySubstance } from '../lib/offers'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { CardIdentity } from '../components/CardIdentity'
import { ExternalLink } from '../components/icons'
import { siteHostLabel } from '../lib/supplierWeb'

function ProposalList({ filters, setFilters, viewSwitch }) {
  const navigate = useNavigate()
  // `view` is this page's own switch, not an API filter.
  const request = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'view'))
  const query = useQuery({ queryKey: procurementKeys.proposals(request), queryFn: ({ signal }) => procurementApi.proposals(request, signal), keepPreviousData: true })
  return <div className="pr-stack">{filters.cardId && <Link className="pr-back-link" to="/procurement/proposals">← Все вещества</Link>}<div className="pr-section-heading"><div><h2>Предложения</h2><p>Нормализованные коммерческие условия с исходными значениями и признаками качества.</p><CardIdentity cardId={filters.cardId} /></div><div className="pr-inline-actions">{viewSwitch}{filters.cardId && <RouterLinkButton to={`/procurement/proposals/compare?cardId=${filters.cardId}`}>Сравнить предложения</RouterLinkButton>}</div></div><ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'COMPLETE', label: 'Готово' }, { value: 'NEEDS_CLARIFICATION', label: 'Нужно уточнение' }, { value: 'CONFLICTING', label: 'Противоречия' }, { value: 'NEEDS_HUMAN_REVIEW', label: 'Нужен специалист' }]} placeholder="Поставщик, валюта, Incoterm или RESP-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <><DataTable rows={query.data.items} onRowClick={row => navigate(`/procurement/proposals/${row.id}`)} emptyTitle="Предложений пока нет" columns={[
      { id: 'supplierName', header: 'Поставщик', cell: row => <div className="pr-primary-cell"><strong>{row.supplierName}</strong><div className="pr-primary-meta"><CopyableId value={row.id} /><span>· рев. {row.revision}</span></div></div> },
      { id: 'supplierWebsite', header: 'Сайт', cell: row => row.supplierWebsite
        ? <a className="pr-supplier-site" href={row.supplierWebsite} target="_blank" rel="noreferrer" title={row.supplierWebsite}><ExternalLink size={13} />{siteHostLabel(row.supplierWebsite)}</a>
        : <span className="pr-muted">—</span> },
      { id: 'price', header: 'Цена', cell: row => row.price ? <strong>{row.price} {row.currency}/{row.priceUnit}</strong> : <StatusBadge status="UNKNOWN" /> },
      { id: 'basis', header: 'Базис', cell: row => row.incoterm ? `${row.incoterm} ${row.namedPlace || ''}` : <StatusBadge status="UNKNOWN" /> },
      { id: 'quantity', header: 'Количество / MOQ', cell: row => <span>{row.quantity || '—'} / {row.moq || '—'}</span> },
      { id: 'documents', header: 'Документы', cell: row => <div className="pr-doc-status"><span>CoA <StatusBadge status={row.coa} compact /></span><span>TDS <StatusBadge status={row.tds} compact /></span></div> },
      { id: 'completeness', header: 'Готовность', cell: row => <StatusBadge status={row.completeness} /> },
    ]} /><Pagination {...query.data} onChange={page => setFilters({ page })} /></>}
  </div>
}

const DEFAULTS = { page: '1', pageSize: '20' }
const GROUP_PAGE = 200

/** One substance: how many offers, how many priced and complete, the prices. */
function SubstanceOffers({ group }) {
  return <Card className="pr-offer-group"><CardContent>
    <div className="pr-offer-group__name">
      <strong>{group.title}</strong>
      <span>{[group.cas && `CAS ${group.cas}`, `${group.offers.length} ${plural(group.offers.length, 'предложение', 'предложения', 'предложений')}`].filter(Boolean).join(' · ')}</span>
    </div>
    <div className="pr-offer-group__prices">
      {group.prices.length ? group.prices.map(price => <strong key={price}>{price}</strong>) : <span className="pr-muted">Цены пока нет — агент уточняет</span>}
    </div>
    <div className="pr-offer-group__counts">
      <span className="pr-offer-count pr-offer-count--priced">{group.priced} с ценой</span>
      <span className="pr-offer-count">{group.complete} {plural(group.complete, 'полное', 'полных', 'полных')}</span>
    </div>
    <div className="pr-inline-actions">
      {group.cardId > 0 && <RouterLinkButton to={`/procurement/proposals/compare?cardId=${group.cardId}`}>Сравнить</RouterLinkButton>}
      {group.cardId > 0 && <RouterLinkButton variant="outline" to={`/procurement/proposals?cardId=${group.cardId}`}>Все предложения</RouterLinkButton>}
    </div>
  </CardContent></Card>
}

function SubstanceView({ filters, setFilters, viewSwitch }) {
  const request = { page: '1', pageSize: String(GROUP_PAGE), ...(filters.search ? { search: filters.search } : {}), ...(filters.status ? { status: filters.status } : {}) }
  const query = useQuery({ queryKey: procurementKeys.proposals(request), queryFn: ({ signal }) => procurementApi.proposals(request, signal), keepPreviousData: true })
  const groups = groupOffersBySubstance(query.data?.items || [])
  const total = query.data?.total
  return <div className="pr-stack">
    <div className="pr-section-heading"><div><h2>Предложения</h2><p>По каждому веществу — сколько ответов, сколько с ценой и какие цены. Какое предложение лучше, решает специалист: сравнение не ранжирует поставщиков.</p></div><div className="pr-inline-actions">{viewSwitch}</div></div>
    <ListFilters filters={filters} onChange={setFilters} statuses={[{ value: 'COMPLETE', label: 'Готово' }, { value: 'NEEDS_CLARIFICATION', label: 'Нужно уточнение' }, { value: 'CONFLICTING', label: 'Противоречия' }, { value: 'NEEDS_HUMAN_REVIEW', label: 'Нужен специалист' }]} placeholder="Поставщик, валюта, Incoterm или RESP-ID" />
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : groups.length
      ? <div className="pr-offer-groups">{groups.map(group => <SubstanceOffers key={group.cardId} group={group} />)}</div>
      : <EmptyState title="Предложений пока нет" description="Ответы поставщиков появятся здесь, как только агент их разберёт." />}
    {total > GROUP_PAGE && <p className="pr-note">Сгруппированы последние {GROUP_PAGE} из {total} предложений. Остальные — в режиме «Списком».</p>}
  </div>
}

export default function ProposalsPage() {
  const [filters, setFilters] = useUrlFilters(DEFAULTS)
  // A substance picked from the grouped view opens its offers as the table.
  const list = filters.view === 'list' || Boolean(filters.cardId)
  const viewSwitch = !filters.cardId && <div className="pr-view-switch" role="group" aria-label="Вид">
    <Button size="sm" variant={list ? 'ghost' : 'outline'} onPress={() => setFilters({ view: '' })}>По веществам</Button>
    <Button size="sm" variant={list ? 'outline' : 'ghost'} onPress={() => setFilters({ view: 'list' })}>Списком</Button>
  </div>
  return list
    ? <ProposalList filters={filters} setFilters={setFilters} viewSwitch={viewSwitch} />
    : <SubstanceView filters={filters} setFilters={setFilters} viewSwitch={viewSwitch} />
}
