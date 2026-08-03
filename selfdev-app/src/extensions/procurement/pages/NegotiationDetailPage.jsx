import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { AlertTriangle, MessageSquare } from '../components/icons'

const kindLabels = { system_outbound: 'Сообщение системы', supplier: 'Ответ поставщика', interpretation: 'Интерпретация агента', human: 'Действие специалиста', error: 'Ошибка' }

export default function NegotiationDetailPage() {
  const { negotiationId } = useParams()
  const query = useQuery({ queryKey: procurementKeys.negotiation(negotiationId), queryFn: ({ signal }) => procurementApi.negotiation(negotiationId, signal) })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Переговоры не найдены" />
  const negotiation = query.data
  return <DetailLayout backTo="/procurement/negotiations" backLabel="Все переговоры" eyebrow={negotiation.id} title={negotiation.supplierName} status={<StatusBadge status={negotiation.status} />} meta={<><Link to={`/procurement/requests/${negotiation.cardId}`}>{negotiation.cardTitle}</Link> · {negotiation.contactName || negotiation.contactId}</>} actions={<Button asChild><Link to={`/chat?context=procurement-negotiation:${negotiation.id}`}><MessageSquare size={16} />Открыть разговор с агентом</Link></Button>} warnings={(negotiation.requiresHuman || negotiation.lastWorkerError) && <Alert tone="warning" icon={<AlertTriangle />} title="Требуется внимание специалиста"><p>{negotiation.lastWorkerError || 'Переговоры приостановлены до решения открытой эскалации.'}</p></Alert>}>
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Текущее состояние</CardTitle></CardHeader><CardContent><DefinitionGrid items={[{ label: 'Канал', value: negotiation.channel }, { label: 'Контакт', value: negotiation.contactName || negotiation.contactId }, { label: 'Доставка', value: <StatusBadge status={negotiation.lastDispatchStatus || 'UNKNOWN'} /> }, { label: 'Следующее действие', value: negotiation.nextAction === 'FOLLOW_UP' ? 'Уточняющий запрос' : 'Отправка согласованного RFQ' }, { label: 'Время действия', value: negotiation.nextActionAt ? new Date(negotiation.nextActionAt).toLocaleString('ru-RU') : 'Не запланировано' }]} /></CardContent></Card>
      {negotiation.proposal && <Card><CardHeader><CardTitle>Текущие коммерческие условия</CardTitle><Link to={`/procurement/proposals/${negotiation.proposal.id}`}>Открыть предложение</Link></CardHeader><CardContent><DefinitionGrid items={[{ label: 'Цена', value: negotiation.proposal.price ? `${negotiation.proposal.price} ${negotiation.proposal.currency}/${negotiation.proposal.priceUnit}` : 'Нет данных' }, { label: 'Базис', value: `${negotiation.proposal.incoterm || '—'} ${negotiation.proposal.namedPlace || ''}` }, { label: 'MOQ', value: negotiation.proposal.moq }, { label: 'Готовность', value: <StatusBadge status={negotiation.proposal.completeness} /> }]} /></CardContent></Card>}</div>
    <Card><CardHeader><CardTitle>Хронология разговора</CardTitle></CardHeader><CardContent className="pr-timeline">{negotiation.messages?.map(message => <article className={`pr-message pr-message--${message.kind}`} key={message.id}><div className="pr-message__marker" /><div><header><div><span className="pr-eyebrow">{kindLabels[message.kind] || message.kind}</span><strong>{message.author}</strong></div><time>{new Date(message.createdAt).toLocaleString('ru-RU')}</time></header><p>{message.text}</p><StatusBadge status={message.status} compact /></div></article>)}</CardContent></Card>
  </DetailLayout>
}
