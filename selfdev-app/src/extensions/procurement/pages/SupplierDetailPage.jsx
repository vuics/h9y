import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ExternalLink } from '../components/icons'

export default function SupplierDetailPage() {
  const { supplierId } = useParams()
  const query = useQuery({ queryKey: procurementKeys.supplier(supplierId), queryFn: ({ signal }) => procurementApi.supplier(supplierId, signal) })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data?.supplier) return <EmptyState title="Поставщик не найден" />
  const { supplier, negotiations = [], proposals = [] } = query.data
  return <DetailLayout backTo="/procurement/suppliers" backLabel="Все поставщики" eyebrow={supplier.id} title={supplier.name} status={<StatusBadge status={supplier.qualificationStatus} />} meta={supplier.country || 'Страна не указана'}>
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Контакты</CardTitle></CardHeader><CardContent className="pr-contact-list">{supplier.contacts.length ? supplier.contacts.map(contact => <div key={contact.id}><div><strong>{contact.name || 'Контакт без имени'}</strong><span>{contact.role || contact.channel}</span></div><div><span>{contact.address}</span><StatusBadge status={contact.verificationStatus} compact /></div></div>) : <EmptyState title="Контактов нет" />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Предлагаемые вещества</CardTitle></CardHeader><CardContent className="pr-capabilities">{supplier.capabilities.map(item => <div key={`${item.casNumber}-${item.source}`}><div><strong>{item.productName || `CAS ${item.casNumber}`}</strong><span>CAS {item.casNumber}</span></div><StatusBadge status={item.verificationStatus} />{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Источник</a>}<small>{item.source}</small></div>)}</CardContent></Card></div>
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Переговоры</CardTitle></CardHeader><CardContent className="pr-linked-list">{negotiations.map(item => <Link key={item.id} to={`/procurement/negotiations/${item.id}`}><div><strong>{item.cardTitle}</strong><span>{item.contactName} · {item.channel}</span></div><StatusBadge status={item.status} /></Link>)}</CardContent></Card><Card><CardHeader><CardTitle>Текущие предложения</CardTitle></CardHeader><CardContent className="pr-linked-list">{proposals.map(item => <Link key={item.id} to={`/procurement/proposals/${item.id}`}><div><strong>{item.price ? `${item.price} ${item.currency}/${item.priceUnit}` : 'Цена не указана'}</strong><span>{item.id} · рев. {item.revision}</span></div><StatusBadge status={item.completeness} /></Link>)}</CardContent></Card></div>
  </DetailLayout>
}
