import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout, DefinitionGrid } from '../components/DetailLayout'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, FileCheck, MessageSquare, Refresh } from '../components/icons'

export default function RequestDetailPage() {
  const { requestId } = useParams()
  const queryClient = useQueryClient()
  const { canWriteCards } = useProcurementPermissions()
  const query = useQuery({ queryKey: procurementKeys.card(requestId), queryFn: ({ signal }) => procurementApi.card(requestId, signal) })
  const normalize = useMutation({
    mutationFn: () => procurementApi.normalizeCard(requestId),
    onSuccess: card => {
      queryClient.setQueryData(procurementKeys.card(requestId), card)
      queryClient.invalidateQueries({ queryKey: procurementKeys.all })
    },
  })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data) return <EmptyState title="Карточка не найдена" />
  const card = query.data
  const warning = ['NEEDS_HUMAN_REVIEW', 'CONFLICTING'].includes(card.completeness) || card.normalizationStatus === 'NEEDS_REVIEW'
  const mutationError = normalize.error?.response?.data?.message || normalize.error?.message
  const warnings = <>{warning && <Alert><AlertTriangle /><AlertTitle>Данные требуют проверки</AlertTitle><AlertDescription>Нормализация или полнота карточки не позволяют считать все параметры подтверждёнными.</AlertDescription></Alert>}{normalize.isError && <Alert><AlertTriangle /><AlertTitle>Нормализация не выполнена</AlertTitle><AlertDescription>{mutationError}</AlertDescription></Alert>}</>
  const actions = <>{canWriteCards && <RouterLinkButton variant="outline" to={`/procurement/requests/${card.id}/edit`}>Редактировать</RouterLinkButton>}{canWriteCards && <Button variant="outline" isDisabled={normalize.isPending} onPress={() => normalize.mutate()}><Refresh />{normalize.isPending ? 'Проверка…' : 'Нормализовать'}</Button>}<RouterLinkButton variant="outline" to={`/procurement/requests/${card.id}/rfq`}><FileCheck />{card.rfqStatus ? 'Открыть RFQ' : 'Подготовить RFQ'}</RouterLinkButton><RouterLinkButton variant="outline" to={`/procurement/requests/${card.id}/echemi`}><ExternalLink />Echemi</RouterLinkButton><RouterLinkButton to={`/chat?context=procurement-card:${card.id}`}><MessageSquare size={16} />Спросить агента</RouterLinkButton></>
  return <DetailLayout backTo="/procurement/requests" backLabel="Все карточки" eyebrow={`Карточка #${card.id}`} title={card.title} status={<StatusBadge status={card.stage} />} meta={<>Обновлено {card.updatedAt ? new Date(card.updatedAt).toLocaleString('ru-RU') : '—'}</>} actions={actions} warnings={warnings}>
    <div className="pr-detail-grid"><Card><CardHeader><CardTitle>Исходные требования</CardTitle></CardHeader><CardContent><DefinitionGrid items={[{ label: 'CAS-номер', value: card.casNumber }, { label: 'Вещество', value: card.substanceName }, { label: 'Чистота / грейд', value: card.purity }, { label: 'Целевой объём', value: card.targetVolume }, { label: 'Нормализация', value: <StatusBadge status={card.normalizationStatus} /> }, { label: 'RFQ', value: <StatusBadge status={card.rfqStatus} /> }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Связанные сущности</CardTitle></CardHeader><CardContent className="pr-related"><Link to={`/procurement/suppliers?cardId=${card.id}`}><strong>{card.supplierCount ?? '—'}</strong><span>поставщиков</span></Link><Link to={`/procurement/negotiations?cardId=${card.id}`}><strong>Открыть</strong><span>переговоры</span></Link><Link to={`/procurement/proposals?cardId=${card.id}`}><strong>{card.proposalCount ?? '—'}</strong><span>предложений</span></Link><Link to={`/procurement/escalations?cardId=${card.id}`}><strong>Проверить</strong><span>эскалации</span></Link></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Состояние данных</CardTitle></CardHeader><CardContent><DefinitionGrid items={[{ label: 'Готовность', value: <StatusBadge status={card.completeness} /> }, { label: 'Текущий этап', value: <StatusBadge status={card.stage} /> }, { label: 'Следующий шаг', value: card.normalizationStatus !== 'NORMALIZED' ? 'Проверить CAS и название через PubChem' : card.stage === 'SOURCING' ? 'Подготовить RFQ и перейти к поиску поставщиков' : card.stage === 'COMPARISON' ? 'Рассмотрение предложений специалистом' : 'Продолжение переговоров и сбор недостающих данных' }]} />{card.normalization && <div className="pr-normalization"><h3>Результат PubChem</h3><DefinitionGrid items={[{ label: 'Preferred name', value: card.normalization.preferredName }, { label: 'PubChem CID', value: card.normalization.cid }, { label: 'Формула', value: card.normalization.molecularFormula }, { label: 'Молекулярная масса', value: card.normalization.molecularWeight }, { label: 'Источник', value: card.normalization.source }]} />{card.normalization.reviewReasons?.length > 0 && <ul>{card.normalization.reviewReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}</div>}</CardContent></Card>
  </DetailLayout>
}
