import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

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
import { EchemiBrowserAccess } from '../components/EchemiBrowserAccess'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Check, CircleAlert, Clock, Pause, Play, Refresh, Send } from '../components/icons'

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
  PAUSED: 'На паузе',
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
  MESSAGE_APPROVAL: 'отправить письма вручную',
}

const CHANNEL_LABEL = {
  EMAIL: 'почта',
  WHATSAPP: 'WhatsApp',
  ECHEMI: 'Echemi',
  WEB_FORM: 'формы на сайтах',
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
  SOURCING_NOT_READY: 'поиск по карточке ещё не готов',
  NO_USABLE_CONTACT: 'не нашли контакт в разрешённых каналах',
}

// Only the statuses a campaign thread actually lands in; the negotiation page
// itself is where the full lifecycle is read.
const THREAD_STATUS = {
  READY: 'подготовлен',
  QUEUED: 'в очереди на отправку',
  ACTIVE: 'агент работает',
  WAITING_SUPPLIER: 'ждём поставщика',
  FOLLOW_UP_DUE: 'пора напомнить',
  COMPLETE: 'завершена',
  ESCALATED: 'передана специалисту',
  CANCELLED: 'отменена',
  PAUSED_BY_CHANGE: 'пауза: карточка изменилась',
  STALE: 'устарела',
}

// What one marketplace request's state is called. The platform's own words
// for a request nobody has posted yet ("NOT_PREPARED") say nothing to a
// specialist; what they need is whether it is out there and, if not, who is
// holding it.
const MARKETPLACE_STATUS = {
  NOT_PREPARED: 'заявки нет',
  RFQ_APPROVAL: 'ждёт согласования RFQ',
  // Written but never carried to the form: the platform calls this
  // AWAITING_APPROVAL from the moment the record exists, and saying "форма
  // заполнена" about it turns a preview that failed into a request that looks
  // ready to send.
  PREPARED: 'черновик заявки создан, форму не заполняли',
  AWAITING_APPROVAL: 'форма заполнена, ждёт вашего согласования',
  APPROVED: 'согласована, не отправлена',
  SUBMITTING: 'отправляется',
  SUBMITTED: 'размещена на площадке',
  NEEDS_REVIEW: 'площадка не подтвердила — закончите в браузере',
  HUMAN_ACTION_REQUIRED: 'площадка просит пройти проверку',
  STALE: 'устарела: карточка или RFQ изменились',
  FAILED: 'не выставлена',
}

const MARKETPLACE_POSTED = new Set(['SUBMITTED', 'SUBMITTING', 'NEEDS_REVIEW'])

const ACTIVE = new Set(['RUNNING'])

// What each kind of wait is called when it is addressed to the specialist
// rather than described in a table cell, and where pressing it takes them.
const ASKS = {
  CANDIDATE_REVIEW: {
    label: 'подтвердить кандидатов',
    to: campaignId => `/procurement/campaigns/${campaignId}/review`,
  },
  RFQ_APPROVAL: {
    label: 'подготовить и согласовать RFQ',
    to: (campaignId, cardId) => `/procurement/requests/${cardId}/rfq`,
  },
  MESSAGE_APPROVAL: {
    label: 'отправить подготовленные письма',
    // The letters, not the card. A specialist told to send something has to
    // land where sending happens; the card is where the requirement is
    // written, and from there they were on their own to find six threads in
    // the negotiations list.
    to: (campaignId, cardId) => `/procurement/negotiations?cardId=${cardId}`,
  },
}

/** Everything the campaign is waiting on a person for, in one list.
 *
 * The information was on the page already — spread across a status badge, a
 * table column and an error code — which meant reading the whole table to find
 * out whether anything was owed at all. A campaign of two hundred substances
 * makes that impossible rather than tedious.
 */
function asksOf(members, campaignId) {
  return members.flatMap(member => {
    // The platform stopped and asked for a person. That ask belongs in the
    // list of things waiting for one, not only in the marketplace block
    // further down the page: a specialist scanning "Ждут вас" is scanning for
    // exactly this, and a request stuck behind a check nobody is told about is
    // a request that never goes out.
    if (member.marketplaceStatus === 'NEEDS_REVIEW') {
      return [{
        key: `mkt-${member.cardId}`,
        cardId: member.cardId,
        title: member.title,
        text: 'закончить заявку на площадке',
        to: `/procurement/requests/${member.cardId}/echemi`,
        blocking: true,
      }]
    }
    if (member.errorCode) {
      return [{
        key: `err-${member.cardId}`,
        cardId: member.cardId,
        title: member.title,
        text: errorText(member.errorCode),
        to: `/procurement/requests/${member.cardId}`,
        blocking: true,
      }]
    }
    const ask = ASKS[member.waitingFor]
    if (!ask) return []
    return [{
      key: `${member.waitingFor}-${member.cardId}`,
      cardId: member.cardId,
      title: member.title,
      text: ask.label,
      to: ask.to(campaignId, member.cardId),
      blocking: false,
    }]
  })
}
const mutationMessage = error => error?.response?.data?.message || error?.message
const errorText = code => ERROR_LABEL[code] || code

export default function CampaignPage() {
  const { campaignId } = useParams()
  // Two presses for the irreversible one, held in the page rather than in a
  // native dialog the browser is free to suppress.
  const [confirmSend, setConfirmSend] = useState(false)
  // A request the platform would not confirm to the browser, but a person saw
  // go through. Keyed by card so two substances can be settled one after the
  // other without the note of one landing on the other.
  const [vouch, setVouch] = useState({})
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    canResearchSourcing, canQueueNegotiations, canOperateEchemi, canSubmitEchemi,
  } = useProcurementPermissions()

  const query = useQuery({
    queryKey: procurementKeys.campaign(campaignId),
    queryFn: ({ signal }) => procurementApi.campaign(campaignId, signal),
    // Polled only while the run is actually moving; a settled campaign is a
    // record, and re-reading it every three seconds tells nobody anything.
    refetchInterval: data => (ACTIVE.has(data?.status) ? 3000 : false),
  })
  const threads = useQuery({
    queryKey: procurementKeys.campaignConversations(campaignId),
    queryFn: ({ signal }) => procurementApi.campaignConversations(campaignId, signal),
  })
  // Where to watch what the agent is doing. Fetched with the block rather than
  // only after a failure: a specialist who has just started a run wants to see
  // the form being filled, not to find the window once something has gone
  // wrong. The password comes with the link because it is asked for one second
  // later, and hunting for it is what makes people give up on watching.
  const browser = useQuery({
    queryKey: procurementKeys.echemiBrowserSession(),
    queryFn: ({ signal }) => procurementApi.echemiBrowserSession(signal),
    enabled: canOperateEchemi,
    retry: false,
  })
  const marketplace = useQuery({
    queryKey: procurementKeys.campaignMarketplace(campaignId),
    queryFn: ({ signal }) => procurementApi.campaignMarketplace(campaignId, signal),
    // Posting runs behind the response — one browser, one form at a time — so
    // the page comes back for the result while a run is going, and stops the
    // moment it is not.
    refetchInterval: data => (data?.running ? 5000 : false),
  })

  const accept = campaign => {
    queryClient.setQueryData(procurementKeys.campaign(campaignId), campaign)
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaigns() })
  }
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelCampaign(campaignId),
    onSuccess: accept,
  })
  const dispatch = useMutation({
    mutationFn: () => procurementApi.dispatchCampaignOutreach(campaignId),
    onSuccess: result => {
      accept(result.campaign)
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaignConversations(campaignId) })
    },
  })
  const sendPrepared = useMutation({
    mutationFn: () => procurementApi.sendCampaignConversations(campaignId),
    onSuccess: result => {
      queryClient.setQueryData(procurementKeys.campaignConversations(campaignId), result.conversations)
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
    },
  })
  const resendMarketplace = useMutation({
    mutationFn: cardId => procurementApi.resendCampaignMarketplace(campaignId, cardId),
    onSuccess: result => queryClient.setQueryData(
      procurementKeys.campaignMarketplace(campaignId), result,
    ),
  })
  const confirmMarketplace = useMutation({
    mutationFn: ({ cardId, inquiryId, note }) =>
      procurementApi.confirmEchemiSubmission(cardId, inquiryId, note),
    onSuccess: (_data, variables) => {
      setVouch(current => ({ ...current, [variables.cardId]: undefined }))
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaignMarketplace(campaignId) })
    },
  })
  const submitMarketplace = useMutation({
    mutationFn: () => procurementApi.submitCampaignMarketplace(campaignId),
    onSuccess: result => queryClient.setQueryData(
      procurementKeys.campaignMarketplace(campaignId), result,
    ),
  })
  const postToMarketplace = useMutation({
    mutationFn: () => procurementApi.dispatchCampaignMarketplace(campaignId),
    onSuccess: result => queryClient.setQueryData(
      procurementKeys.campaignMarketplace(campaignId), result,
    ),
  })
  const resume = useMutation({
    mutationFn: () => procurementApi.resumeCampaign(campaignId),
    onSuccess: accept,
  })
  const hold = useMutation({
    mutationFn: () => procurementApi.pauseCampaign(campaignId),
    onSuccess: accept,
  })
  const carryOn = useMutation({
    mutationFn: () => procurementApi.unpauseCampaign(campaignId),
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
  const holdable = ['RUNNING', 'AWAITING_REVIEW', 'INTERRUPTED'].includes(campaign.status)
  const stoppable = holdable || campaign.status === 'PAUSED'
  // Substances with a verified supplier that nothing has been sent to yet.
  // The count is what makes the button honest: it says how much work is left,
  // not merely that a button exists.
  const undispatched = members.filter(
    member => member.stage === 'AWAITING_REVIEW' && member.verifiedCount > 0 && !member.requestCount,
  ).length
  const percent = progress.total ? Math.round((progress.settled / progress.total) * 100) : 0
  const threadsView = threads.data
  const conversations = threadsView?.items || []
  const awaitingPerson = threadsView?.awaitingPerson || 0
  const unreachable = threadsView?.unreachable || []
  const channelsLabel = (threadsView?.channels || []).map(item => CHANNEL_LABEL[item] || item).join(', ')
  const hasEchemi = (threadsView?.channels || []).includes('ECHEMI')
  const marketplaceView = postToMarketplace.data || marketplace.data
  const marketplaceItems = marketplaceView?.items || []
  // What is left to post, not merely that something is: a specialist reading
  // "выставить заявки" has to know whether that is one substance or ninety.
  const marketplacePending = marketplaceView?.pending || 0
  const marketplaceStopped = marketplaceView?.stopped
  // Filled, checked, and one press from the platform. A different question
  // from `pending`: those still need the browser to go and fill a form.
  const marketplaceAwaiting = marketplaceView?.awaitingApproval || 0
  const marketplaceNeedsReview = marketplaceItems.filter(
    item => item.status === 'NEEDS_REVIEW',
  ).length
  const busyMarketplace = postToMarketplace.isPending
    || submitMarketplace.isPending
    || Boolean(marketplaceView?.running)
  const asks = asksOf(members, campaignId)

  return <DetailLayout
    backTo="/procurement/campaigns"
    backLabel="К кампаниям"
    eyebrow={<CopyableId value={campaign.campaignId} />}
    title={campaign.title}
    status={<Badge variant={campaign.status === 'AWAITING_REVIEW' ? 'secondary' : 'outline'}>{CAMPAIGN_STATUS[campaign.status] || campaign.status}</Badge>}
    meta={`${progress.total} ${plural(progress.total, 'вещество', 'вещества', 'веществ')} · ${REACH_LABEL[plan.reach] || plan.reach}`}
    actions={canResearchSourcing && <>
      {/* Pausing sits before stopping, and stopping keeps the quieter variant:
          ending a run of two hundred substances is not the button a hand should
          land on when it meant "wait a moment". */}
      {holdable && <Button variant="outline" isDisabled={hold.isPending} onPress={() => hold.mutate()}><Pause />{hold.isPending ? 'Останавливаем…' : 'Пауза'}</Button>}
      {campaign.status === 'PAUSED' && <Button isDisabled={carryOn.isPending} onPress={() => carryOn.mutate()}><Play className={carryOn.isPending ? 'pr-spin' : undefined} />{carryOn.isPending ? 'Продолжаем…' : 'Продолжить'}</Button>}
      {stoppable && <Button variant="ghost" isDisabled={cancel.isPending} onPress={() => cancel.mutate()}><CircleAlert />{cancel.isPending ? 'Останавливаем…' : 'Остановить совсем'}</Button>}
    </>}
    warnings={<>
      {(cancel.error || resume.error || dispatch.error || hold.error || carryOn.error) && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{mutationMessage(cancel.error || resume.error || dispatch.error || hold.error || carryOn.error)}</AlertDescription></Alert>}
      {campaign.status === 'PAUSED' && <Alert><Pause /><AlertTitle>Кампания на паузе</AlertTitle><AlertDescription>Поиск и рассылка по ней стоят, найденное сохранено. Уже начатые переписки продолжают идти сами: переговоры принадлежат карточке и согласованному RFQ, а не кампании, поэтому остановить их можно на странице конкретных переговоров.</AlertDescription></Alert>}
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
          {/* Companies, not substances. `contactTotal` sums each substance's
              count of candidates we have an address for, so a run of two
              substances can and does report twenty-six. */}
          <div><dt>Кандидатов с контактами</dt><dd>{progress.contactTotal}</dd></div>
          <div><dt>Подтверждено поставщиков</dt><dd>{progress.verifiedTotal ?? 0}</dd></div>
          <div><dt>Запросов отправлено</dt><dd>{progress.requestTotal ?? 0}</dd></div>
          <div><dt>Ответов получено</dt><dd>{progress.responseTotal ?? 0}</dd></div>
          <div><dt>Ждут решения</dt><dd>{progress.awaitingReview}</dd></div>
          <div><dt>С ошибкой</dt><dd>{progress.failed}</dd></div>
        </dl>
        {progress.awaitingReview > 0 && <>
          <p className="pr-note">Кандидат становится поставщиком только после явного подтверждения специалиста — кампания не присваивает этот статус сама. Согласование собрано на одном экране: кому пишем и что спрашиваем, по всем веществам сразу. Запросы уходят сразу после согласования.</p>
          <div className="pr-inline-actions">
            <RouterLinkButton to={`/procurement/campaigns/${campaignId}/review`}>Согласовать {progress.awaitingReview} {plural(progress.awaitingReview, 'вещество', 'вещества', 'веществ')}</RouterLinkButton>
            {/* For a campaign approved before dispatch existed, and for the
                substances whose first attempt failed on one supplier. Opening a
                conversation that exists returns the one that exists, so this is
                safe to press twice. */}
            {undispatched > 0 && canQueueNegotiations && <Button variant="outline" isDisabled={dispatch.isPending} onPress={() => dispatch.mutate()}><Send className={dispatch.isPending ? 'pr-spin' : undefined} />{dispatch.isPending ? 'Отправляем…' : `Отправить запросы (${undispatched})`}</Button>}
          </div>
        </>}
      </CardContent></Card>

      {asks.length > 0 && <Card className="pr-campaign-asks"><CardHeader><div>
        <CardTitle>Ждут вас</CardTitle>
        <p>Пока эти решения не приняты, кампания по ним не двинется. Всё остальное она делает сама.</p>
      </div></CardHeader><CardContent>
        <ul className="pr-campaign-asks__list">
          {asks.map(ask => <li key={ask.key} className={ask.blocking ? 'is-blocked' : undefined}>
            {ask.blocking ? <CircleAlert size={13} /> : <Clock size={13} />}
            <Link to={ask.to}>{ask.title}</Link>
            <span>#{ask.cardId}</span>
            <b>{ask.text}</b>
          </li>)}
          {awaitingPerson > 0 && <li>
            <Clock size={13} />
            <span className="pr-campaign-asks__all">Подготовленные письма</span>
            <b>{awaitingPerson} {plural(awaitingPerson, 'ждёт', 'ждут', 'ждут')} отправки — ниже</b>
          </li>}
        </ul>
      </CardContent></Card>}

      {unreachable.length > 0 && <Card><CardHeader><div>
        <CardTitle>Некому написать</CardTitle>
        <p>Эти компании вы подтвердили, но кампания не нашла у них адреса в разрешённых каналах{channelsLabel ? ` (${channelsLabel})` : ''}. Допишите контакт на карточке поставщика — и запустите рассылку ещё раз.</p>
      </div></CardHeader><CardContent>
        <ul className="pr-campaign-threads">
          {unreachable.map(entry => <li key={entry.cardId}>
            <div className="pr-campaign-threads__head">
              <Link to={`/procurement/requests/${entry.cardId}`}>{entry.title}</Link>
              <span>#{entry.cardId}</span>
            </div>
            <ul>
              {entry.suppliers.map(supplier => <li key={supplier.supplierId}>
                <Link to={`/procurement/suppliers/${supplier.supplierId}`}>{supplier.name}</Link>
                <span className="pr-primary-meta">{supplier.otherChannels?.length
                  ? `отвечает в других каналах: ${supplier.otherChannels.join(', ')}`
                  : 'контактов нет вовсе'}</span>
              </li>)}
            </ul>
          </li>)}
        </ul>
      </CardContent></Card>}

      {marketplaceView?.enabled && marketplaceItems.length > 0 && <Card><CardHeader><div>
        <CardTitle>Заявки на площадку</CardTitle>
        <p>Одна заявка на вещество, видна всем продавцам Echemi сразу — адресата у неё нет, поэтому и переписки нет: продавцы приходят с предложениями. Заявка собирается из карточки и настроек закупщика, руками ничего не вводится, так что согласован тот же текст, что и в RFQ.</p>
      </div></CardHeader><CardContent>
        {resendMarketplace.error && <Alert><AlertTriangle /><AlertTitle>Не отправлено</AlertTitle><AlertDescription>{mutationMessage(resendMarketplace.error)}</AlertDescription></Alert>}
        {resendMarketplace.data?.confirmed && <Alert><Check /><AlertTitle>Заявка уже была на площадке</AlertTitle><AlertDescription>Список заявок Echemi показывает её по этому CAS, поэтому второй раз она не отправлялась — запись просто догнала действительность.</AlertDescription></Alert>}
        {confirmMarketplace.error && <Alert><AlertTriangle /><AlertTitle>Не записано</AlertTitle><AlertDescription>{mutationMessage(confirmMarketplace.error)}</AlertDescription></Alert>}
        {(postToMarketplace.error || submitMarketplace.error) && <Alert><AlertTriangle /><AlertTitle>Заявки не выставлены</AlertTitle><AlertDescription>{mutationMessage(postToMarketplace.error || submitMarketplace.error)}</AlertDescription></Alert>}
        {/* One browser fills one form at a time, so a run that meets a
            verification page or a dead worker stops there rather than driving
            two hundred substances into the same wall. Saying which substance
            it stopped on is what makes the stop actionable. */}
        {marketplaceStopped && <Alert><CircleAlert /><AlertTitle>Выставление остановлено</AlertTitle><AlertDescription>
          {marketplaceStopped.message}
          {marketplaceStopped.noVncUrl && <> Пройдите проверку в браузере — ссылка и пароль ниже — и запустите ещё раз.</>}
        </AlertDescription></Alert>}
        {marketplaceNeedsReview > 0 && <p className="pr-note">Площадка иногда просит подтвердить, что заявку отправляет человек. Пройти эту проверку за вас агент не может и не должен, поэтому он останавливается и оставляет форму открытой: пройдите проверку в браузере, отправьте заявку там же — и нажмите «Заявка ушла — записать», чтобы кампания перестала считать её неотправленной. Если проверку вы уже прошли и не уверены, ушла заявка или нет, — нажмите «Проверить и отправить»: система спросит у самой площадки, есть ли там заявка по этому CAS, и либо запишет её как размещённую, либо отправит заново. Вслепую повторять отправку она не станет — это был бы риск второй заявки по тому же веществу.</p>}
        {marketplaceAwaiting > 0 && !marketplaceView?.running && <p className="pr-note">Формы заполнены и ждут вас. Отправка необратима: заявку видят все продавцы Echemi, и отозвать её из системы нельзя — на площадке она снимается вручную.</p>}
        {confirmSend && <Alert><AlertTriangle /><AlertTitle>Отправка необратима</AlertTitle><AlertDescription>
          {marketplaceAwaiting} {plural(marketplaceAwaiting, 'заявка уйдёт', 'заявки уйдут', 'заявок уйдут')} на Echemi и станут видны всем продавцам площадки. Формы уже заполнены и проверены — перед отправкой каждая согласуется тем же порядком, что и на карточке.
        </AlertDescription></Alert>}
        {marketplaceView?.running && <p className="pr-note">Идёт выставление: заявки уходят по одной через общий браузер, это занимает минуты на вещество. Страница обновляется сама.</p>}
        {canOperateEchemi && <EchemiBrowserAccess
          access={browser.data}
          error={browser.error}
          loading={browser.isLoading}
          compact
        />}

        {(marketplacePending > 0 || marketplaceAwaiting > 0) && canOperateEchemi && <div className="pr-inline-actions">
          {marketplacePending > 0 && <Button
            variant={marketplaceAwaiting > 0 ? 'outline' : 'default'}
            isDisabled={busyMarketplace}
            onPress={() => postToMarketplace.mutate()}
          >
            <Send className={busyMarketplace ? 'pr-spin' : undefined} />
            {marketplaceView?.running ? 'Работаем…' : `Заполнить формы (${marketplacePending})`}
          </Button>}
          {/* The press that actually publishes. Separate from filling the
              forms because it is the irreversible half, and confirmed once for
              the batch rather than once per substance: a campaign of a hundred
              is a hundred identical decisions the specialist already made when
              they approved the RFQ.

              Confirmed in the page, the way the single-card screen does it,
              and not with `window.confirm`: a native dialog is suppressible by
              the browser, and when it is suppressed the press silently does
              nothing — which is exactly what happened the first time this
              button was used. */}
          {marketplaceAwaiting > 0 && canSubmitEchemi && (confirmSend
            ? <>
                <Button variant="outline" isDisabled={busyMarketplace} onPress={() => setConfirmSend(false)}>
                  Отмена
                </Button>
                <Button isDisabled={busyMarketplace} onPress={() => { setConfirmSend(false); submitMarketplace.mutate() }}>
                  <Send className={busyMarketplace ? 'pr-spin' : undefined} />
                  {marketplaceView?.running ? 'Отправляем…' : `Да, отправить ${marketplaceAwaiting}`}
                </Button>
              </>
            : <Button isDisabled={busyMarketplace} onPress={() => setConfirmSend(true)}>
                <Send className={busyMarketplace ? 'pr-spin' : undefined} />
                {marketplaceView?.running ? 'Отправляем…' : `Согласовать и отправить (${marketplaceAwaiting})`}
              </Button>)}
        </div>}

        <ul className="pr-campaign-threads">
          {marketplaceItems.map(item => <li key={item.cardId}>
            <div className="pr-campaign-threads__head">
              <Link to={`/procurement/requests/${item.cardId}`}>{item.title}</Link>
              <span>#{item.cardId}{item.casNumber ? ` · CAS ${item.casNumber}` : ''}</span>
              <StatusBadge
                status={MARKETPLACE_POSTED.has(item.status) ? 'SUBMITTED' : item.status}
                label={MARKETPLACE_STATUS[item.status] || item.status}
              />
            </div>
            {/* Echemi asks a person to pass its check, and the automation is
                not allowed to answer that for them — so the request is left
                exactly where it stopped and this is the way back. Sending it
                by hand in noVNC is the specialist's job; recording that it
                went is what stops the campaign from showing a live request as
                a failure for ever. */}
            {item.status === 'NEEDS_REVIEW' && canSubmitEchemi && item.inquiryId && <div className="pr-inline-actions">
              {/* The question the browser could not answer, put to the party
                  that knows: Echemi lists every inquiry the account holds. It
                  is there — the record catches up and nothing is sent twice.
                  It is not — the click created nothing and the request goes
                  out in the same press. */}
              <Button
                size="sm"
                isDisabled={resendMarketplace.isPending}
                onPress={() => resendMarketplace.mutate(item.cardId)}
              >
                <Send className={resendMarketplace.isPending && resendMarketplace.variables === item.cardId ? 'pr-spin' : undefined} />
                {resendMarketplace.isPending && resendMarketplace.variables === item.cardId
                  ? 'Проверяем на площадке…'
                  : 'Проверить и отправить'}
              </Button>
              {vouch[item.cardId] === undefined
                ? <Button size="sm" variant="outline" onPress={() => setVouch(current => ({
                    ...current, [item.cardId]: 'Отправлено вручную через noVNC, площадка подтвердила заявку.',
                  }))}>Заявка ушла — записать</Button>
                : <>
                    <input
                      className="pr-thread__search"
                      value={vouch[item.cardId]}
                      placeholder="Что вы увидели на площадке"
                      onChange={event => setVouch(current => ({ ...current, [item.cardId]: event.target.value }))}
                    />
                    <Button size="sm" variant="outline" onPress={() => setVouch(current => ({ ...current, [item.cardId]: undefined }))}>Отмена</Button>
                    <Button
                      size="sm"
                      isDisabled={confirmMarketplace.isPending || (vouch[item.cardId] || '').trim().length < 8}
                      onPress={() => confirmMarketplace.mutate({
                        cardId: item.cardId,
                        inquiryId: item.inquiryId,
                        note: vouch[item.cardId].trim(),
                      })}
                    >Записать</Button>
                  </>}
              <Link to={`/procurement/requests/${item.cardId}/echemi`}>открыть карточку</Link>
            </div>}
            {(item.platformInquiryId || item.error) && <ul>
              <li>
                {item.platformInquiryId && <span className="pr-primary-meta">номер на площадке: {item.platformInquiryId}</span>}
                {/* Said in the past tense when it is in the past. "Не
                    выставить" reads as a standing verdict, and a run that
                    failed an hour ago is a thing that happened — the causes
                    the server can re-check it has already re-checked. */}
                {item.error && <span className="pr-import-missing">
                  {item.errorFromLastRun
                    ? `при попытке ${item.errorAt ? new Date(item.errorAt).toLocaleString('ru-RU') : '(время не записано)'}: `
                    : ''}{item.error}
                </span>}
              </li>
            </ul>}
          </li>)}
        </ul>
      </CardContent></Card>}

      {conversations.length > 0 && <Card><CardHeader><div>
        <CardTitle>Переписки кампании</CardTitle>
        <p>{awaitingPerson > 0
          ? `${awaitingPerson} ${plural(awaitingPerson, 'запрос подготовлен', 'запроса подготовлены', 'запросов подготовлены')} и ${plural(awaitingPerson, 'ждёт', 'ждут', 'ждут')} отправки.`
          : 'Все запросы отправлены — переписки идут сами.'}
          {threadsView?.draftFirst && ' Кампания запущена с показом каждого письма перед отправкой, поэтому агент их не отправляет сам.'}</p>
        {/* A marketplace request is not in this list on purpose: it has no
            contact behind it and no thread. It has its own block above. */}
        {hasEchemi && <p className="pr-note">Заявки на площадку Echemi — отдельным блоком выше: у них нет адресата и переписки, одна заявка на вещество видна всем продавцам сразу. Здесь только переписка с контактами.</p>}
      </div></CardHeader><CardContent>
        {sendPrepared.error && <Alert><AlertTriangle /><AlertTitle>Отправка не выполнена</AlertTitle><AlertDescription>{mutationMessage(sendPrepared.error)}</AlertDescription></Alert>}
        {sendPrepared.data && <Alert>{sendPrepared.data.errors?.length ? <CircleAlert /> : <Check />}<AlertTitle>Отправлено: {sendPrepared.data.sent?.length ?? 0}</AlertTitle><AlertDescription>
          {sendPrepared.data.skipped?.length > 0 && <p>Пропущено по устаревшему RFQ: {sendPrepared.data.skipped.length}. Такой запрос написан по тексту, который с тех пор пересобрали — согласуйте RFQ заново.</p>}
          {sendPrepared.data.errors?.length > 0 && <ul className="pr-plain-list">{sendPrepared.data.errors.map(item => <li key={item.assignmentId}><Link to={`/procurement/negotiations/${item.assignmentId}`}>{item.assignmentId}</Link> — {item.message}</li>)}</ul>}
        </AlertDescription></Alert>}

        {awaitingPerson > 0 && canQueueNegotiations && <div className="pr-inline-actions">
          <Button isDisabled={sendPrepared.isPending} onPress={() => sendPrepared.mutate()}>
            <Send className={sendPrepared.isPending ? 'pr-spin' : undefined} />
            {sendPrepared.isPending ? 'Отправляем…' : `Отправить все подготовленные (${awaitingPerson})`}
          </Button>
        </div>}

        {/* Grouped by substance and linked, because the number on its own sent
            the specialist to the negotiations list to find these by hand. */}
        <ul className="pr-campaign-threads">
          {conversations.map(item => <li key={item.cardId}>
            <div className="pr-campaign-threads__head">
              <Link to={`/procurement/requests/${item.cardId}`}>{item.title}</Link>
              <span>#{item.cardId}{item.casNumber ? ` · CAS ${item.casNumber}` : ''}</span>
            </div>
            <ul>
              {item.conversations.map(thread => <li key={thread.assignmentId}>
                <Link to={`/procurement/negotiations/${thread.assignmentId}`}>{thread.supplierName || thread.assignmentId}</Link>
                <span className="pr-primary-meta">{thread.channel}{thread.answered ? ' · есть ответ' : ''}</span>
                {thread.awaitingPerson
                  ? <StatusBadge status="NEEDS_REVIEW" label={thread.automationPaused ? 'агент остановлен' : 'ждёт отправки'} />
                  : <StatusBadge status={thread.status} label={THREAD_STATUS[thread.status] || thread.status} />}
              </li>)}
            </ul>
          </li>)}
        </ul>
      </CardContent></Card>}

      <DataTable
        rows={members}
        rowKey="cardId"
        onRowClick={row => navigate(row.sourcingRunId
          ? `/procurement/requests/${row.cardId}/sourcing`
          : `/procurement/requests/${row.cardId}`)}
        emptyTitle="В кампании нет веществ"
        columns={[
          { id: 'title', header: 'Вещество', cell: row => <div className="pr-primary-cell"><strong>{row.title}</strong><div className="pr-primary-meta"><CopyableId value={row.cardId} displayValue={`#${row.cardId}`} to={`/procurement/requests/${row.cardId}`} /><span>· CAS {row.casNumber || 'не указан'}</span></div></div> },
          { id: 'stage', header: 'Этап', cell: row => <StatusBadge status={row.stage} label={MEMBER_STAGE[row.stage] || row.stage} /> },
          { id: 'candidates', header: 'Кандидатов', cell: row => row.candidateCount || '—' },
          { id: 'contacts', header: 'Из них с контактами', cell: row => row.contactCount || '—' },
          { id: 'verified', header: 'Подтверждено', cell: row => row.verifiedCount || '—' },
          { id: 'requests', header: 'Запросов', cell: row => row.requestCount ? `${row.requestCount}${row.responseCount ? ` · ${row.responseCount} отв.` : ''}` : '—' },
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
