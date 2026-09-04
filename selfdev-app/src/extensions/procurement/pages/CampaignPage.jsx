import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { plural } from '../components/SourcingSettings'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CircleAlert, Refresh } from '../components/icons'

/** One campaign: substance by stage, with the decisions it is waiting for.
 *
 * The labels are local rather than added to the shared `StatusBadge` map: a
 * campaign's `SOURCING` means "this substance is being searched now", while a
 * card's means "the purchase is at the sourcing stage", and one word cannot
 * carry both without one of the screens lying.
 */

const CAMPAIGN_STATUS = {
  RUNNING: 'Идёт',
  AWAITING_REVIEW: 'Ждёт согласования',
  COMPLETED: 'Завершена',
  FAILED: 'Не выполнена',
  CANCELLED: 'Остановлена',
  INTERRUPTED: 'Прервана перезапуском',
}

const MEMBER_STAGE = {
  QUEUED: 'В очереди',
  SOURCING: 'Ищем поставщиков',
  CONTACTS: 'Собираем контакты',
  AWAITING_REVIEW: 'Ждёт решения',
  OUTREACH: 'Рассылка',
  NEGOTIATION: 'Переговоры',
  DONE: 'Готово',
  FAILED: 'Ошибка',
  SKIPPED: 'Пропущено',
}

const WAITING_FOR = {
  CANDIDATE_REVIEW: 'подтвердить кандидатов',
  RFQ_APPROVAL: 'согласовать RFQ',
}

const REACH_LABEL = {
  SOURCING: 'только поиск',
  CONTACTS: 'поиск и контакты',
  OUTREACH: 'до рассылки запросов',
  NEGOTIATION: 'до сравнимых предложений',
}

const ERROR_LABEL = {
  CARD_NOT_FOUND: 'карточка не найдена',
  SOURCING_ENGINE_UNAVAILABLE: 'ни один движок поиска не доступен',
  SOURCING_RUN_FAILED: 'поиск прервался ошибкой',
  CAMPAIGN_DRIVER_FAILED: 'сбой в самой кампании',
  CARD_NOT_NORMALIZED: 'карточка не нормализована',
}

const ACTIVE = new Set(['RUNNING'])
const mutationMessage = error => error?.response?.data?.message || error?.message
const errorText = code => ERROR_LABEL[code] || code

export default function CampaignPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canResearchSourcing } = useProcurementPermissions()

  const query = useQuery({
    queryKey: procurementKeys.campaign(campaignId),
    queryFn: ({ signal }) => procurementApi.campaign(campaignId, signal),
    // Polled only while the run is actually moving; a settled campaign is a
    // record, and re-reading it every three seconds tells nobody anything.
    refetchInterval: data => (ACTIVE.has(data?.status) ? 3000 : false),
  })

  const accept = campaign => {
    queryClient.setQueryData(procurementKeys.campaign(campaignId), campaign)
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaigns() })
  }
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelCampaign(campaignId),
    onSuccess: accept,
  })
  const resume = useMutation({
    mutationFn: () => procurementApi.resumeCampaign(campaignId),
    onSuccess: accept,
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const campaign = query.data
  if (!campaign) return <EmptyState title="Кампания не найдена" />

  const { progress, plan, members = [] } = campaign
  // The restart already has its own explained alert with a button on it;
  // repeating the raw code underneath adds jargon, not information.
  const errors = (campaign.errors || []).filter(code => code !== 'campaign:INTERRUPTED_BY_RESTART')
  const running = ACTIVE.has(campaign.status)
  const percent = progress.total ? Math.round((progress.settled / progress.total) * 100) : 0

  return <DetailLayout
    backTo="/procurement/campaigns"
    backLabel="К кампаниям"
    eyebrow={<CopyableId value={campaign.campaignId} />}
    title={campaign.title}
    status={<Badge variant={campaign.status === 'AWAITING_REVIEW' ? 'secondary' : 'outline'}>{CAMPAIGN_STATUS[campaign.status] || campaign.status}</Badge>}
    meta={`${progress.total} ${plural(progress.total, 'вещество', 'вещества', 'веществ')} · ${REACH_LABEL[plan.reach] || plan.reach}`}
    actions={running && canResearchSourcing && <Button variant="outline" isDisabled={cancel.isPending} onPress={() => cancel.mutate()}><CircleAlert />{cancel.isPending ? 'Останавливаем…' : 'Остановить'}</Button>}
    warnings={<>
      {(cancel.error || resume.error) && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{mutationMessage(cancel.error || resume.error)}</AlertDescription></Alert>}
      {campaign.status === 'INTERRUPTED' && <Alert><AlertTriangle /><AlertTitle>Кампания прервана перезапуском сервиса</AlertTitle><AlertDescription>Найденное сохранено — оно в таблице ниже. Продолжение подхватит только те вещества, которые ничем не закончились: уже найденное не ищется заново, а решения специалиста не спрашиваются повторно. {canResearchSourcing && <Button variant="outline" size="sm" isDisabled={resume.isPending} onPress={() => resume.mutate()}><Refresh className={resume.isPending ? 'pr-spin' : undefined} />{resume.isPending ? 'Продолжаем…' : 'Продолжить'}</Button>}</AlertDescription></Alert>}
      {errors.length > 0 && <Alert><CircleAlert /><AlertTitle>Замечания по запуску</AlertTitle><AlertDescription><ul className="pr-plain-list">{errors.map(code => <li key={code}>{code.startsWith('card:CARD_NOT_FOUND:') ? `Карточка #${code.split(':').pop()} не найдена и в кампанию не вошла` : errorText(code)}</li>)}</ul></AlertDescription></Alert>}
    </>}
  >
    <div className="pr-stack">
      <Card><CardHeader><div>
        <CardTitle>Ход кампании</CardTitle>
        <p>Пройдено {progress.settled} из {progress.total}. Вещество считается пройденным и тогда, когда оно ждёт решения: машина по нему свою работу закончила.</p>
      </div></CardHeader><CardContent>
        <div className="pr-campaign-bar" role="img" aria-label={`Готово ${percent}%`}><span style={{ width: `${percent}%` }} /></div>
        <dl className="pr-definitions">
          <div><dt>Найдено кандидатов</dt><dd>{progress.candidateTotal}</dd></div>
          <div><dt>Веществ с контактами</dt><dd>{progress.contactTotal}</dd></div>
          <div><dt>Ждут решения</dt><dd>{progress.awaitingReview}</dd></div>
          <div><dt>С ошибкой</dt><dd>{progress.failed}</dd></div>
        </dl>
        {progress.awaitingReview > 0 && <>
          <p className="pr-note">Кандидат становится поставщиком только после явного подтверждения специалиста — кампания не присваивает этот статус сама. Согласование собрано на одном экране: кому пишем и что спрашиваем, по всем веществам сразу.</p>
          <div className="pr-inline-actions"><RouterLinkButton to={`/procurement/campaigns/${campaignId}/review`}>Согласовать {progress.awaitingReview} {plural(progress.awaitingReview, 'вещество', 'вещества', 'веществ')}</RouterLinkButton></div>
        </>}
      </CardContent></Card>

      <DataTable
        rows={members}
        rowKey="cardId"
        onRowClick={row => navigate(row.sourcingRunId
          ? `/procurement/requests/${row.cardId}/sourcing`
          : `/procurement/requests/${row.cardId}`)}
        emptyTitle="В кампании нет веществ"
        columns={[
          { id: 'title', header: 'Вещество', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><div className="pr-primary-meta"><CopyableId value={row.cardId} displayValue={`#${row.cardId}`} /><span>· CAS {row.casNumber || 'не указан'}</span></div></div> },
          { id: 'stage', header: 'Этап', cell: row => <StatusBadge status={row.stage} label={MEMBER_STAGE[row.stage] || row.stage} /> },
          { id: 'candidates', header: 'Кандидатов', cell: row => row.candidateCount || '—' },
          { id: 'contacts', header: 'С контактами', cell: row => row.contactCount || '—' },
          { id: 'verified', header: 'Подтверждено', cell: row => row.verifiedCount || '—' },
          { id: 'waiting', header: 'Что дальше', cell: row => row.errorCode
            ? <span className="pr-import-missing">{errorText(row.errorCode)}</span>
            : row.waitingFor
              ? WAITING_FOR[row.waitingFor] || row.waitingFor
              : '—' },
        ]}
      />
    </div>
  </DetailLayout>
}
