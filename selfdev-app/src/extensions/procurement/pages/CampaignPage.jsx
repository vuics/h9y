import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { CopyableId } from '../components/CopyableId'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { plural } from '../components/SourcingSettings'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { EchemiBrowserAccess } from '../components/EchemiBrowserAccess'
import { CampaignPhaseBar, memberPhases } from '../components/CampaignPhaseBar'
import { PHASE_FILTER, phaseOfFilter } from '../lib/campaignPhases'
import { CampaignLaunchPanel } from '../components/CampaignLaunchPanel'
import { readableAgentError } from '../lib/agentText'
import { CampaignHistory } from '../components/CampaignHistory'
import { CampaignMembers } from '../components/CampaignMembers'
import { groupOffersBySubstance } from '../lib/offers'
import { MODES, memberAwaitsReview, modeOf } from '../lib/memberSections'
import { useCampaignReview } from '../hooks/useCampaignReview'
import { BulkVerdicts, IdentitySummary, ReviewAlerts, ReviewBar } from '../components/CampaignReview'
import { offerTotals } from '../lib/campaignView'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Check, CircleAlert, Clock, Pause, Pencil, Play, Refresh, Send, Sliders, Trash } from '../components/icons'

/** One campaign: substance by stage, with the decisions it is waiting for.
 *
 * The labels are local rather than added to the shared `StatusBadge` map: a
 * campaign's `SOURCING` means "this substance is being searched now", while a
 * card's means "the purchase is at the sourcing stage", and one word cannot
 * carry both without one of the screens lying.
 */

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
  CAMPAIGN_DRIVER_FAILED: 'сбой в самой закупке',
  CARD_NOT_NORMALIZED: 'карточка не нормализована',
  SOURCING_NOT_READY: 'поиск по карточке ещё не готов',
  NO_USABLE_CONTACT: 'не нашли контакт в разрешённых каналах',
  // Why the campaign could not take an approval step it was told to take.
  SOURCING_REVIEW_REQUIRED: 'автоматически не подтвердить: у запустившего нет права SOURCING_REVIEW',
  CARD_WRITE_REQUIRED: 'RFQ автоматически не согласовать: у запустившего нет права CARD_WRITE',
  CARD_INCOMPLETE: 'RFQ не подготовить: в карточке не заполнены поля',
  RFQ_NOT_PREPARED: 'RFQ не подготовлен',
  AUTOPILOT_FAILED: 'автоматическое согласование не удалось — решите вручную',
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
  // A draft-first campaign leaves the form unfilled until the press that
  // sends it, so "форма заполнена" is not something this label may promise.
  AWAITING_APPROVAL: 'ждёт вашего согласования',
  APPROVED: 'согласована, не отправлена',
  SUBMITTING: 'отправляется',
  SUBMITTED: 'размещена на площадке',
  NEEDS_REVIEW: 'площадка не подтвердила — закончите в браузере',
  HUMAN_ACTION_REQUIRED: 'площадка просит пройти проверку',
  STALE: 'устарела: карточка или RFQ изменились',
  FAILED: 'не выставлена',
  // Echemi lists it as "Invalid Inquiries" and never showed it to sellers —
  // HCl and acetone, both drug precursors, were refused that way.
  REJECTED: 'площадка отклонила заявку',
  // The old request is retired and the new one not prepared yet: "Подготовить
  // заявки" below makes it. Once prepared, the new request is what is shown.
  REPOSTED: 'ждёт повторного размещения',
}

const MARKETPLACE_POSTED = new Set(['SUBMITTED', 'SUBMITTING', 'NEEDS_REVIEW'])

// Coloured by who has to act, not left to the shared map: these are the
// platform's own states, and an unknown one there reads as green "in progress"
// — which is how a request blocked by a card with no unit looked fine.
const MARKETPLACE_TONE = {
  RFQ_APPROVAL: 'warning',
  PREPARED: 'warning',
  AWAITING_APPROVAL: 'warning',
  APPROVED: 'waiting',
  SUBMITTING: 'progress',
  SUBMITTED: 'complete',
  NEEDS_REVIEW: 'warning',
  HUMAN_ACTION_REQUIRED: 'warning',
  STALE: 'warning',
  FAILED: 'danger',
  REJECTED: 'danger',
  REPOSTED: 'warning',
}
const marketplaceTone = item => item.status === 'NOT_PREPARED'
  ? (item.error ? 'danger' : 'muted')
  : MARKETPLACE_TONE[item.status]

const ACTIVE = new Set(['RUNNING'])

const shortTime = value => value
  ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : null

// One line per marketplace request about the offers sellers left on it. The
// platform's list counts offers its inquiry page never shows the buyer (Na2CO3:
// two counted, none shown, in the account's own browser), so three numbers:
// counted, shown, and in the comparison. Only shown-but-not-filed is ours.
const unreadQuotes = quotations => quotations
  ? Math.max(0, (quotations.visible ?? quotations.published ?? 0) - quotations.ingested)
  : 0

function MarketplaceQuotes({ quotations }) {
  if (!quotations) return null
  const published = quotations.published ?? 0
  const visible = quotations.visible ?? published
  const hidden = Math.max(0, published - visible)
  const unread = unreadQuotes(quotations)
  return <span className={unread > 0 ? 'pr-marketplace-quotes is-behind' : 'pr-marketplace-quotes'}>
    {published > 0
      ? `предложений на Echemi: ${published}${hidden > 0 ? ` (площадка показывает ${visible})` : ''} · в сравнении: ${quotations.ingested}${unread > 0 ? ` · не забрано: ${unread}` : ''}`
      // Only this request's offers: answers by email are in the table above.
      : 'на Echemi предложений пока нет'}
    {quotations.collectedAt && ` · проверено ${shortTime(quotations.collectedAt)}`}
  </span>
}

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
  // Dead ends the approval screen cannot settle: every candidate is decided
  // and none verified, or the verified ones cannot be reached. They used to
  // read "на согласовании" and lead to a page with nothing to approve.
  SUPPLIER_EVIDENCE: {
    label: 'нет подтверждённого поставщика — найти или подтвердить',
    to: (campaignId, cardId) => `/procurement/requests/${cardId}/sourcing`,
  },
  SUPPLIER_CONTACT: {
    label: 'у поставщиков нет контакта — добавить',
    to: (campaignId, cardId) => `/procurement/requests/${cardId}`,
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

// The server's own rule, repeated so the button is offered only where it can
// work: held or stopped, and not one substance started.
const DELETABLE_STATUSES = new Set(['PAUSED', 'CANCELLED', 'FAILED', 'INTERRUPTED'])
const campaignDeletable = campaign => DELETABLE_STATUSES.has(campaign?.status)
  && (campaign.members || []).every(member => member.stage === 'QUEUED'
    && !member.sourcingRunId && !member.requestCount && !member.marketplaceInquiryId)

// The server's rule for taking a substance out, so the button appears only
// where it will work.
const removable = (member, campaign) =>
  !['OUTREACH', 'NEGOTIATION'].includes(member.stage)
  && !member.requestCount && !member.marketplaceInquiryId
  && (!['SOURCING', 'CONTACTS'].includes(member.stage) || campaign.status === 'PAUSED')

const deleteMessage = error => {
  const status = error?.response?.status
  const data = error?.response?.data
  // Not deployed yet: the gateway does not list the route, or the service
  // answers with FastAPI's bare "Not Found".
  const missing = status === 405 || data?.code === 'ENDPOINT_NOT_ALLOWED'
    || (status === 404 && data?.detail === 'Not Found')
  if (missing) return 'Удаление закупок заработает после обновления сервера. Пока закупку можно остановить кнопкой «Остановить совсем» — остановленные скрыты из списка закупок.'
  const detail = error?.response?.data?.detail
  if (detail?.code === 'CAMPAIGN_HAS_WORK') return 'По закупке уже шла работа — её можно только остановить.'
  if (detail?.code === 'CAMPAIGN_NOT_DELETABLE') return 'Идущую закупку сначала поставьте на паузу.'
  return detail?.message || mutationMessage(error)
}
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

  // Prices per substance, in one read rather than one per card: the table
  // answers "что уже пришло" without sending anyone to another tab.
  const memberIds = (query.data?.members || []).map(member => member.cardId)
  const offersFilters = { cardIds: memberIds.join(','), page: 1, pageSize: 200 }
  const offers = useQuery({
    queryKey: procurementKeys.proposals(offersFilters),
    queryFn: ({ signal }) => procurementApi.proposals(offersFilters, signal),
    enabled: memberIds.length > 0,
    staleTime: 30000,
    retry: 1,
  })

  const accept = campaign => {
    queryClient.setQueryData(procurementKeys.campaign(campaignId), campaign)
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaigns() })
  }
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelCampaign(campaignId),
    onSuccess: accept,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moreActions, setMoreActions] = useState(false)
  // Which substances the table shows, and whether the one-line "ждут вас"
  // is unfolded into the full list.
  const [filter, setFilter] = useState('all')
  // Which table the page shows, in the address so a link or Back keeps it.
  const [searchParams, setSearchParams] = useSearchParams()
  const view = modeOf(searchParams.get('view'))
  const showView = next => setSearchParams(current => {
    const params = new URLSearchParams(current)
    if (next === 'members') params.delete('view')
    else params.set('view', next)
    return params
  })
  // The approval lives in the positions too. Loaded once it is asked for —
  // by its mode, by «Всё», or by opening one position's approval — because
  // it carries every candidate of every substance.
  const [reviewWanted, setReviewWanted] = useState(false)
  const review = useCampaignReview(campaignId, { enabled: view === 'review' || view === 'all' || reviewWanted })
  const reviewData = review.query.data
  // Leaving with decisions a person changed and did not send loses them.
  const unsentReview = review.touched && review.decisions.length > 0
  useEffect(() => {
    if (!unsentReview) return undefined
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsentReview])
  const [showAsks, setShowAsks] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)
  const [savedEffects, setSavedEffects] = useState(null)
  // The generated name lists the first substances ("… и ещё 23"), which stops
  // telling campaigns apart once there are several; a person names it instead.
  const [draftTitle, setDraftTitle] = useState(null)
  const rename = useMutation({
    mutationFn: title => procurementApi.changeCampaignSettings(campaignId, { title }),
    onSuccess: result => {
      accept(result)
      setDraftTitle(null)
    },
  })
  const research = useMutation({
    mutationFn: cardIds => procurementApi.researchCampaignCards(campaignId, cardIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) }),
  })
  const removeCard = useMutation({
    mutationFn: cardId => procurementApi.removeCampaignCard(campaignId, cardId),
    onSuccess: accept,
  })
  const remove = useMutation({
    mutationFn: () => procurementApi.deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: procurementKeys.campaign(campaignId) })
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaigns() })
      navigate('/procurement/campaigns')
    },
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
  // Echemi's "Post Again": a request no seller answered is put back on top of
  // sellers' feeds. Asked once more before it goes, because it is published to
  // every seller on the platform and cannot be taken back from here.
  const [repostAsk, setRepostAsk] = useState(null)
  // Pressed beside one request rather than for the batch: asked there too.
  const [repostInRow, setRepostInRow] = useState(false)
  const repostMarketplace = useMutation({
    mutationFn: cardIds => procurementApi.repostCampaignMarketplace(campaignId, cardIds),
    onSuccess: result => {
      setRepostAsk(null)
      queryClient.setQueryData(procurementKeys.campaignMarketplace(campaignId), result)
    },
  })
  const collectMarketplaceQuotes = useMutation({
    mutationFn: cardId => procurementApi.collectEchemiQuotations(cardId, true),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaignMarketplace(campaignId) })
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

  // One substance's marketplace presses, used in its row in the table and in
  // the box below it: the same question asked in two places must not be two
  // different sets of buttons.
  const marketplaceActions = item => item.status === 'NEEDS_REVIEW' && canSubmitEchemi && item.inquiryId
    ? <div className="pr-inline-actions">
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
              // The check after Send stopped it and the form is held open:
              // this press sends that same form once the list says it is not
              // there yet.
              : item.verificationStage === 'AFTER_SUBMIT' ? 'Проверка пройдена — отправить' : 'Проверить и отправить'}
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
    </div>
    : null

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const campaign = query.data
  if (!campaign) return <EmptyState title="Закупка не найдена" />

  const { progress, plan, members = [] } = campaign
  // The restart already has its own explained alert with a button on it;
  // repeating the raw code underneath adds jargon, not information.
  const errors = (campaign.errors || []).filter(code => code !== 'campaign:INTERRUPTED_BY_RESTART')
  const holdable = ['RUNNING', 'AWAITING_REVIEW', 'INTERRUPTED'].includes(campaign.status)
  const stoppable = holdable || campaign.status === 'PAUSED'
  // Substances with a verified supplier that nothing has been sent to yet.
  // The count is what makes the button honest: it says how much work is left,
  // not merely that a button exists.
  // Not those with no usable contact: pressing again would open nothing, and
  // "Отправить запросы (2)" promised two sends that could not happen.
  const undispatched = members.filter(
    member => member.stage === 'AWAITING_REVIEW' && member.verifiedCount > 0 && !member.requestCount
      && member.waitingFor !== 'SUPPLIER_CONTACT' && member.errorCode !== 'NO_USABLE_CONTACT',
  ).length
  const threadsView = threads.data
  const conversations = threadsView?.items || []
  // Two different things a person owes a conversation, counted apart: a
  // letter prepared and never sent, which «Отправить» sends; and a
  // conversation whose agent was stopped, which only its own page settles —
  // closed, or the agent resumed. Counted together, «1 письмо готово к
  // отправке» on CMP-433EC89B1A was Lab Alley's refusal, and the send button
  // did nothing with it.
  const threadRows = (threadsView?.items || []).flatMap(item => item.conversations.map(thread => ({ ...thread, cardId: item.cardId })))
  const awaitingPerson = threadRows.filter(thread => thread.status === 'READY').length
  const pausedThreads = threadRows.filter(thread => thread.automationPaused && thread.status !== 'READY').length
  const unsentCards = new Set(threadRows.filter(thread => thread.status === 'READY').map(thread => thread.cardId))
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
  // "Отправить подготовленные письма" only where a letter is in fact unsent:
  // a substance whose letters are queued or gone owes nothing.
  const asks = asksOf(members, campaignId)
    .filter(ask => !ask.key.startsWith('MESSAGE_APPROVAL-') || !threadsView || unsentCards.has(ask.cardId))
  const conversationsByCard = new Map(conversations.map(item => [item.cardId, item]))
  const marketplaceQuotes = marketplaceView?.quotations
  const repostable = marketplaceItems.filter(item => item.repostable).map(item => item.cardId)
  const lastCollection = browser.data?.lastCollection
  const marketplaceByCard = new Map(marketplaceItems.map(item => [item.cardId, item]))
  // A server without the cardIds filter answers with every offer; grouping by
  // card and keeping this campaign's substances makes that harmless.
  const offersByCard = new Map(
    groupOffersBySubstance(offers.data?.items || [])
      .filter(group => memberIds.includes(group.cardId))
      .map(group => [group.cardId, group]),
  )
  const offerCounts = offerTotals(offersByCard)
  const phases = memberPhases(members, offersByCard)

  const threadTotal = conversations.reduce((total, item) => total + item.conversations.length, 0)
  const hasMarketplace = Boolean(marketplaceView?.enabled && marketplaceItems.length > 0)

  // A press in a row asks or answers in the strip above the table, whatever
  // the mode: a confirmation shown only in a folded block below is lost.
  const marketplaceAsking = Boolean((repostAsk && !repostInRow) || confirmSend
    || repostMarketplace.error || repostMarketplace.data?.reposting?.length
    || collectMarketplaceQuotes.error || resendMarketplace.error || resendMarketplace.data?.confirmed
    || confirmMarketplace.error || postToMarketplace.error || submitMarketplace.error)
  const marketplaceOnTop = hasMarketplace && (view === 'echemi' || view === 'all' || marketplaceAsking)
  const threadsOnTop = conversations.length > 0 && (view === 'threads' || view === 'all' || Boolean(sendPrepared.data || sendPrepared.error))
  // Asked where it was pressed: beside the one request, or above the table
  // for the whole batch.
  const repostConfirm = repostAsk && <Alert><AlertTriangle /><AlertTitle>{`Разместить заново: ${repostAsk.length}`}</AlertTitle><AlertDescription>
          <p>Как «Post Again» на Echemi: заявка публикуется ещё раз и снова видна всем продавцам площадки сверху ленты. Старая остаётся, предложения на неё продолжают собираться. Размещаются только заявки старше трёх дней, на которых площадка не показывает ни одного предложения — в том числе те, где она предложения считает, но не показывает.{plan.draftFirst ? ' Новые заявки сначала придут вам на согласование.' : ''}</p>
          <div className="pr-inline-actions">
            <Button isDisabled={repostMarketplace.isPending} onPress={() => repostMarketplace.mutate(repostAsk)}>
              {repostMarketplace.isPending ? 'Размещаем…' : 'Да, разместить заново'}
            </Button>
            <Button variant="outline" onPress={() => setRepostAsk(null)}>Отмена</Button>
          </div>
        </AlertDescription></Alert>
  const marketplaceIntro = <p>Одна заявка на вещество, видна всем продавцам Echemi сразу — адресата у неё нет, поэтому и переписки нет: продавцы приходят с предложениями. Заявка собирается из карточки и настроек закупщика, руками ничего не вводится, так что согласован тот же текст, что и в RFQ.</p>
  const conversationsIntro = <>
        <p>{awaitingPerson > 0
          ? `${awaitingPerson} ${plural(awaitingPerson, 'запрос подготовлен', 'запроса подготовлены', 'запросов подготовлены')} и ${plural(awaitingPerson, 'ждёт', 'ждут', 'ждут')} отправки.`
          : 'Все запросы отправлены — переписки идут сами.'}
          {threadsView?.draftFirst && ' Закупка запущена с показом каждого письма перед отправкой, поэтому агент их не отправляет сам.'}</p>
        {pausedThreads > 0 && <p>{`${pausedThreads} ${plural(pausedThreads, 'переписка', 'переписки', 'переписок')} на паузе: агент остановлен. Это не письмо к отправке — откройте переписку (она подсвечена в позиции) и закройте её или возобновите агента.`}</p>}
  </>
  // The status as the marketplace list colours it: by who has to act.
  const marketplaceBadge = item => <StatusBadge
    status={MARKETPLACE_POSTED.has(item.status) ? 'SUBMITTED' : item.status}
    label={MARKETPLACE_STATUS[item.status] || item.status}
    tone={marketplaceTone(item)}
    compact
  />
  const marketplaceSummary = marketplaceQuotes && <p className="pr-marketplace-summary">
          {`Размещено: ${marketplaceView.posted} из ${marketplaceView.total}`}
          {marketplaceView.rejected > 0 && ` · отклонено площадкой: ${marketplaceView.rejected}`}
          {` · предложений от продавцов: ${marketplaceQuotes.published}, в сравнении: ${marketplaceQuotes.ingested}`}
          {marketplaceQuotes.unread > 0 && <strong>{` · не забрано: ${marketplaceQuotes.unread}`}</strong>}
          {marketplaceQuotes.hidden > 0 && ` · ещё ${marketplaceQuotes.hidden} площадка считает, но не показывает`}
          {marketplaceQuotes.lastCollectedAt && ` · последний сбор ${shortTime(marketplaceQuotes.lastCollectedAt)}`}
        </p>
  const marketplaceToolbar = <>
        {/* The collector reads offers every fifteen minutes in the agent's
            browser. A lapsed session used to look exactly like "no offers";
            this is where it says so instead. */}
        {lastCollection && lastCollection.outcome !== 'OK' && <Alert><CircleAlert /><AlertTitle>{lastCollection.outcome === 'LOGIN'
          ? 'Сбор предложений остановлен: нужен вход в Echemi'
          : 'Сбор предложений остановлен'}</AlertTitle><AlertDescription>
          {lastCollection.outcome === 'LOGIN'
            ? 'Площадка разлогинила браузер агента. Откройте браузер Echemi ниже и войдите — следующий сбор (раз в 15 минут) заберёт всё, что продавцы оставили за это время.'
            : lastCollection.outcome === 'HUMAN_ACTION'
              ? 'Площадка просит пройти проверку в браузере агента. Пройдите её в браузере Echemi ниже.'
              : `Последняя попытка ${shortTime(lastCollection.at)} не удалась: ${lastCollection.error || 'причина не записана'}.`}
        </AlertDescription></Alert>}
        {repostMarketplace.error && <Alert><AlertTriangle /><AlertTitle>Заново не размещено</AlertTitle><AlertDescription>{mutationMessage(repostMarketplace.error)}</AlertDescription></Alert>}
        {repostMarketplace.data?.reposting?.length > 0 && <Alert><Check /><AlertTitle>{`Размещаются заново: ${repostMarketplace.data.reposting.length}`}</AlertTitle><AlertDescription>
          {plan.draftFirst
            ? 'Новые заявки подготовлены и ждут вас — кнопка «Согласовать и отправить» ниже. Предложения на старые заявки по-прежнему собираются.'
            : 'Заявки уходят по одной через общий браузер. Предложения на старые заявки по-прежнему собираются.'}
        </AlertDescription></Alert>}
        {canOperateEchemi && repostable.length > 0 && !repostAsk && <div className="pr-inline-actions">
          <Button variant="outline" isDisabled={repostMarketplace.isPending || marketplaceView?.running} onPress={() => { setRepostInRow(false); setRepostAsk(repostable) }}>
            {`Разместить заново без видимых предложений (${repostable.length})`}
          </Button>
        </div>}
        {!repostInRow && repostConfirm}
        {collectMarketplaceQuotes.error && <Alert><AlertTriangle /><AlertTitle>Предложения не забраны</AlertTitle><AlertDescription>{mutationMessage(collectMarketplaceQuotes.error)}</AlertDescription></Alert>}
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
        {marketplaceNeedsReview > 0 && <p className="pr-note">Площадка иногда просит подтвердить, что заявку отправляет человек. Пройти эту проверку за вас агент не может и не должен, поэтому он останавливается и оставляет форму открытой: пройдите проверку в браузере, отправьте заявку там же — и нажмите «Заявка ушла — записать», чтобы закупка перестала считать её неотправленной. Если проверку вы уже прошли и не уверены, ушла заявка или нет, — нажмите «Проверить и отправить»: система спросит у самой площадки, есть ли там заявка по этому CAS, и либо запишет её как размещённую, либо отправит заново. Вслепую повторять отправку она не станет — это был бы риск второй заявки по тому же веществу.</p>}
        {marketplaceAwaiting > 0 && !marketplaceView?.running && <p className="pr-note">{plan.draftFirst
          ? 'Заявки ждут вас. По кнопке каждая форма заполняется, сверяется с согласованным RFQ и сразу отправляется — заранее формы не заполняются, их всё равно нельзя было бы посмотреть.'
          : 'Формы заполнены и ждут вас.'} Отправка необратима: заявку видят все продавцы Echemi, и отозвать её из системы нельзя — на площадке она снимается вручную.</p>}
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
            {marketplaceView?.running ? 'Работаем…' : `${plan.draftFirst ? 'Подготовить заявки' : 'Заполнить формы'} (${marketplacePending})`}
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
  </>
  // What one request says beyond its status: its number, its offers, and
  // the presses that act on it alone. Shown in its row and in the list.
  const marketplaceDetails = item => <>
    {repostInRow && repostAsk?.[0] === item.cardId && <div className="pr-inline-confirm">{repostConfirm}</div>}
                {item.platformInquiryId && <span className="pr-primary-meta">номер на площадке: {item.platformInquiryId}</span>}
                <MarketplaceQuotes quotations={item.quotations} />
                {item.platformMessage && <span className="pr-import-missing">{item.platformMessage}</span>}
                {canOperateEchemi && item.repostable && !repostAsk && <Button
                    size="sm"
                    variant="outline"
                    isDisabled={repostMarketplace.isPending || marketplaceView?.running}
                    onPress={() => { setRepostInRow(true); setRepostAsk([item.cardId]) }}
                  >
                    Разместить заново
                  </Button>}
                {canOperateEchemi && unreadQuotes(item.quotations) > 0
                  && <Button
                    size="sm"
                    variant="outline"
                    isDisabled={collectMarketplaceQuotes.isPending}
                    onPress={() => collectMarketplaceQuotes.mutate(item.cardId)}
                  >
                    {collectMarketplaceQuotes.isPending && collectMarketplaceQuotes.variables === item.cardId
                      ? 'Забираем…'
                      : 'Забрать предложения'}
                  </Button>}
                {/* Said in the past tense when it is in the past. "Не
                    выставить" reads as a standing verdict, and a run that
                    failed an hour ago is a thing that happened — the causes
                    the server can re-check it has already re-checked. */}
                {item.error && <span className="pr-import-missing">
                  {item.errorFromLastRun
                    ? `при попытке ${item.errorAt ? new Date(item.errorAt).toLocaleString('ru-RU') : '(время не записано)'}: `
                    : ''}{readableAgentError(item.error)}
                </span>}
  </>
  const marketplaceCard = marketplaceView?.enabled && marketplaceItems.length > 0 && <Card><CardHeader><div>
        {marketplaceIntro}
        {marketplaceSummary}
      </div></CardHeader><CardContent>
        {marketplaceOnTop ? <p className="pr-note">Действия по всем заявкам — над таблицей.</p> : marketplaceToolbar}

        <ul className="pr-campaign-threads">
          {marketplaceItems.map(item => <li key={item.cardId}>
            <div className="pr-campaign-threads__head">
              <Link to={`/procurement/requests/${item.cardId}`}>{item.title}</Link>
              <span>#{item.cardId}{item.casNumber ? ` · CAS ${item.casNumber}` : ''}</span>
              <StatusBadge
                status={MARKETPLACE_POSTED.has(item.status) ? 'SUBMITTED' : item.status}
                label={MARKETPLACE_STATUS[item.status] || item.status}
                tone={marketplaceTone(item)}
              />
            </div>
            {/* Echemi asks a person to pass its check, and the automation is
                not allowed to answer that for them — so the request is left
                exactly where it stopped and this is the way back. Sending it
                by hand in noVNC is the specialist's job; recording that it
                went is what stops the campaign from showing a live request as
                a failure for ever. */}
            {marketplaceActions(item)}
            {(item.platformInquiryId || item.error || item.platformMessage) && <ul>
              <li>{marketplaceDetails(item)}</li>
            </ul>}
          </li>)}
        </ul>
      </CardContent></Card>
  const conversationsToolbar = <>
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
  </>
  const conversationsCard = conversations.length > 0 && <Card><CardHeader><div>
        {conversationsIntro}
        {/* A marketplace request is not in this list on purpose: it has no
            contact behind it and no thread. It has its own block above. */}
        {hasEchemi && <p className="pr-note">Заявки на площадку Echemi — отдельным блоком выше: у них нет адресата и переписки, одна заявка на вещество видна всем продавцам сразу. Здесь только переписка с контактами.</p>}
      </div></CardHeader><CardContent>
        {threadsOnTop ? <p className="pr-note">Действия по всем перепискам — над таблицей.</p> : conversationsToolbar}

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
      </CardContent></Card>
  const reviewWaiting = members.filter(memberAwaitsReview).length
  const failedAsks = asks.filter(ask => ask.key.startsWith('err-')).length
  // What only the per-substance list says: no verified supplier, no contact.
  const otherAsks = asks.filter(ask => ['SUPPLIER_EVIDENCE-', 'SUPPLIER_CONTACT-'].some(prefix => ask.key.startsWith(prefix))).length
  const waitingTotal = reviewWaiting + awaitingPerson + pausedThreads + marketplaceNeedsReview + failedAsks + otherAsks
  const modeCounts = {
    members: members.length,
    review: reviewWaiting,
    offers: offerCounts.offers,
    threads: threadTotal,
    echemi: hasMarketplace ? marketplaceItems.length : 0,
  }
  const modeAlerts = {
    review: reviewWaiting > 0 && 'ждут вас',
    threads: [
      awaitingPerson > 0 && `${awaitingPerson} ${plural(awaitingPerson, 'ждёт', 'ждут', 'ждут')} отправки`,
      pausedThreads > 0 && `${pausedThreads} на паузе`,
    ].filter(Boolean).join(' · '),
    echemi: marketplaceNeedsReview > 0 && `${marketplaceNeedsReview} требует внимания`,
  }

  return <DetailLayout
    backTo="/procurement"
    backLabel="К закупкам"
    eyebrow={<CopyableId value={campaign.campaignId} />}
    title={campaign.title}
    status={<CampaignStatusBadge status={campaign.status} />}
    meta={`${progress.total} ${plural(progress.total, 'вещество', 'вещества', 'веществ')} · ${REACH_LABEL[plan.reach] || plan.reach}`}
    actions={canResearchSourcing && <>
      {draftTitle === null && <Button variant="ghost" onPress={() => { setDraftTitle(campaign.title); rename.reset() }}><Pencil />Переименовать</Button>}
      {campaign.status !== 'CANCELLED' && <Button variant="outline" onPress={() => { setEditingSettings(value => !value); setSavedEffects(null) }}><Sliders />{editingSettings ? 'Скрыть настройки' : 'Настройки закупки'}</Button>}
      {/* Pausing sits before stopping, and stopping keeps the quieter variant:
          ending a run of two hundred substances is not the button a hand should
          land on when it meant "wait a moment". */}
      {holdable && <Button variant="outline" isDisabled={hold.isPending} onPress={() => hold.mutate()}><Pause />{hold.isPending ? 'Останавливаем…' : 'Пауза'}</Button>}
      {campaign.status === 'PAUSED' && <Button isDisabled={carryOn.isPending} onPress={() => carryOn.mutate()}><Play className={carryOn.isPending ? 'pr-spin' : undefined} />{carryOn.isPending ? 'Продолжаем…' : 'Продолжить'}</Button>}
      {(stoppable || campaignDeletable(campaign)) && !moreActions && <Button variant="ghost" onPress={() => setMoreActions(true)}>Ещё…</Button>}
      {moreActions && stoppable && <Button variant="ghost" isDisabled={cancel.isPending} onPress={() => cancel.mutate()} aria-description="Останавливает закупку и закрывает её переговоры: напоминания и неотправленные письма не уйдут"><CircleAlert />{cancel.isPending ? 'Останавливаем…' : 'Остановить совсем'}</Button>}
      {moreActions && campaignDeletable(campaign) && (confirmDelete
        ? <>
          <Button variant="destructive" isDisabled={remove.isPending} onPress={() => remove.mutate()}><Trash />{remove.isPending ? 'Удаляем…' : 'Удалить закупку навсегда'}</Button>
          <Button variant="outline" isDisabled={remove.isPending} onPress={() => { setConfirmDelete(false); remove.reset() }}>Отмена</Button>
        </>
        : <Button variant="ghost" onPress={() => setConfirmDelete(true)}><Trash />Удалить</Button>)}
    </>}
    warnings={<>
      {removeCard.error && <Alert><AlertTriangle /><AlertTitle>Вещество не убрано</AlertTitle><AlertDescription>{removeCard.error?.response?.data?.detail?.message || mutationMessage(removeCard.error)}</AlertDescription></Alert>}
      {savedEffects && <Alert><Check /><AlertTitle>Настройки сохранены</AlertTitle><AlertDescription>
        Действуют на то, что ещё впереди.
        {savedEffects.requeued?.length > 0 && <> Продолжено веществ с их готовым поиском: {savedEffects.requeued.length}.</>}
        {savedEffects.released?.length > 0 && <> Снятые проверки выполняются для веществ, ждущих согласования, — ход будет виден в истории ниже.</>}
      </AlertDescription></Alert>}
      {remove.error && <Alert><AlertTriangle /><AlertTitle>Закупка не удалена</AlertTitle><AlertDescription>{deleteMessage(remove.error)}</AlertDescription></Alert>}
      {research.data && <Alert>{research.data.started.length ? <Check /> : <CircleAlert />}<AlertTitle>{research.data.started.length ? `Поиск запущен заново: ${research.data.started.length}` : 'Поиск не запущен'}</AlertTitle><AlertDescription>
        {research.data.started.length > 0 && <>Ход поиска видно в строках таблицы; когда он закончится, найденное сольётся с прежним. </>}
        {research.data.skipped.length > 0 && <>Пропущено: {research.data.skipped.map(item => `#${item.cardId} — ${item.code === 'SEARCH_RUNNING' ? 'поиск уже идёт' : item.code === 'NOT_IN_CAMPAIGN' ? 'не в закупке' : item.message || item.code}`).join('; ')}.</>}
      </AlertDescription></Alert>}
      {research.error && <Alert><AlertTriangle /><AlertTitle>Поиск не запущен</AlertTitle><AlertDescription>{mutationMessage(research.error)}</AlertDescription></Alert>}
      {cancel.data?.effects && <Alert><Check /><AlertTitle>Закупка остановлена</AlertTitle><AlertDescription>
        Закрыто переговоров: {cancel.data.effects.cancelledNegotiations}, отклонено неотправленных писем: {cancel.data.effects.rejectedDrafts}. Вещества, которые ведёт другая закупка, не затронуты; история переписки сохранена.
      </AlertDescription></Alert>}
            {(cancel.error || resume.error || dispatch.error || hold.error || carryOn.error) && <Alert><AlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{mutationMessage(cancel.error || resume.error || dispatch.error || hold.error || carryOn.error)}</AlertDescription></Alert>}
      {campaign.status === 'PAUSED' && <Alert><Pause /><AlertTitle>Закупка на паузе</AlertTitle><AlertDescription>Поиск и рассылка по ней стоят, найденное сохранено. Уже начатые переписки продолжают идти сами: переговоры принадлежат карточке и согласованному RFQ, а не закупке, поэтому остановить их можно на странице конкретных переговоров.</AlertDescription></Alert>}
      {campaign.status === 'INTERRUPTED' && <Alert><AlertTriangle /><AlertTitle>Закупка прервана перезапуском сервиса</AlertTitle><AlertDescription>Найденное сохранено — оно в таблице ниже. Продолжение подхватит только те вещества, которые ничем не закончились: уже найденное не ищется заново, а решения специалиста не спрашиваются повторно. {canResearchSourcing && <Button variant="outline" size="sm" isDisabled={resume.isPending} onPress={() => resume.mutate()}><Refresh className={resume.isPending ? 'pr-spin' : undefined} />{resume.isPending ? 'Продолжаем…' : 'Продолжить'}</Button>}</AlertDescription></Alert>}
      {errors.length > 0 && <Alert><CircleAlert /><AlertTitle>Замечания по запуску</AlertTitle><AlertDescription><ul className="pr-plain-list">{errors.map(code => <li key={code}>{code.startsWith('card:CARD_NOT_FOUND:') ? `Карточка #${code.split(':').pop()} не найдена и в закупку не вошла` : errorText(code)}</li>)}</ul></AlertDescription></Alert>}
    </>}
  >
    <div className="pr-stack">
      {draftTitle !== null && <Card><CardHeader><CardTitle>Название закупки</CardTitle></CardHeader><CardContent>
        <form className="pr-inline-actions" onSubmit={event => {
          event.preventDefault()
          if (draftTitle.trim()) rename.mutate(draftTitle.trim())
        }}>
          <Input
            value={draftTitle}
            aria-label="Название закупки"
            maxLength={200}
            autoFocus
            onChange={event => setDraftTitle(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') setDraftTitle(null) }}
          />
          <Button type="submit" isDisabled={!draftTitle.trim() || rename.isPending}><Check />{rename.isPending ? 'Сохраняем…' : 'Сохранить'}</Button>
          <Button variant="outline" isDisabled={rename.isPending} onPress={() => setDraftTitle(null)}>Отмена</Button>
        </form>
        {rename.error && <Alert><AlertTriangle /><AlertTitle>Название не сохранено</AlertTitle><AlertDescription>{rename.error?.response?.data?.detail?.message || mutationMessage(rename.error)}</AlertDescription></Alert>}
      </CardContent></Card>}
      {editingSettings && <CampaignLaunchPanel
        campaign={campaign}
        canEdit={canResearchSourcing}
        onCancel={() => setEditingSettings(false)}
        onSaved={result => {
          accept(result)
          setSavedEffects(result.effects || null)
          setEditingSettings(false)
        }}
      />}
      {/* One line each: how far the run got, and what it is waiting on a
          person for. The table is what the page is opened for, so everything
          above it is a summary, never a block to scroll past. */}
      <div className="pr-campaign-summary">
        <div className="pr-campaign-summary__phases">
          <CampaignPhaseBar
            counts={phases}
            total={progress.total}
            legend
            selected={phaseOfFilter(filter)}
            onSelect={key => setFilter(key ? `${PHASE_FILTER}${key}` : 'all')}
          />
        </div>
        <div className="pr-campaign-summary__chips">
          <button type="button" className="pr-chip" onClick={() => setFilter('all')}>{progress.candidateTotal} кандидатов</button>
          <button type="button" className="pr-chip" onClick={() => setFilter('all')}>{progress.contactTotal} с контактами</button>
          <button type="button" className="pr-chip" onClick={() => setFilter('all')}>{progress.verifiedTotal ?? 0} подтверждено</button>
          <button type="button" className="pr-chip" onClick={() => setFilter('working')}>{progress.requestTotal ?? 0} запросов</button>
          {/* Counted from the offers themselves: a substance answered through
              the marketplace has no conversation to count an answer on. */}
          <Link className="pr-chip" to="/procurement/proposals">{offerCounts.offers} {plural(offerCounts.offers, 'предложение', 'предложения', 'предложений')}{offerCounts.priced > 0 ? `, ${offerCounts.priced} с ценой` : ''}</Link>
          {progress.failed > 0 && <button type="button" className="pr-chip pr-chip--danger" onClick={() => setFilter('failed')}>{progress.failed} с ошибкой</button>}
        </div>
      </div>

      {/* One line of what waits for a person, one press per kind of thing, each
          answered on this page. The per-substance list is one click away. */}
      {waitingTotal > 0 && <div className="pr-campaign-waiting">
        <div className="pr-campaign-waiting__line">
          <b>Ждут вас:</b>
          <div className="pr-inline-actions">
            {reviewWaiting > 0 && <Button size="sm" onPress={() => showView('review')}>Согласовать {reviewWaiting} {plural(reviewWaiting, 'позицию', 'позиции', 'позиций')}</Button>}
            {/* For a campaign approved before dispatch existed, and for the
                substances whose first attempt failed on one supplier. Opening a
                conversation that exists returns the one that exists, so this is
                safe to press twice. */}
            {progress.awaitingReview > 0 && undispatched > 0 && canQueueNegotiations && <Button size="sm" variant="outline" isDisabled={dispatch.isPending} onPress={() => dispatch.mutate()}><Send className={dispatch.isPending ? 'pr-spin' : undefined} />{dispatch.isPending ? 'Отправляем…' : `Отправить запросы (${undispatched})`}</Button>}
            {awaitingPerson > 0 && (canQueueNegotiations
              ? <Button size="sm" isDisabled={sendPrepared.isPending} onPress={() => { showView('threads'); sendPrepared.mutate() }}><Send className={sendPrepared.isPending ? 'pr-spin' : undefined} />{sendPrepared.isPending ? 'Отправляем…' : `Отправить ${awaitingPerson} ${plural(awaitingPerson, 'письмо', 'письма', 'писем')}`}</Button>
              : <Button size="sm" variant="outline" onPress={() => showView('threads')}>{`${awaitingPerson} ${plural(awaitingPerson, 'письмо готово', 'письма готовы', 'писем готовы')} к отправке`}</Button>)}
            {pausedThreads > 0 && <Button size="sm" variant="outline" onPress={() => showView('threads')}>{`${pausedThreads} ${plural(pausedThreads, 'переписка', 'переписки', 'переписок')}: агент остановлен`}</Button>}
            {marketplaceNeedsReview > 0 && <Button size="sm" variant="outline" onPress={() => showView('echemi')}>{`${marketplaceNeedsReview} ${plural(marketplaceNeedsReview, 'заявка', 'заявки', 'заявок')} Echemi ждёт проверки`}</Button>}
            {failedAsks > 0 && <Button size="sm" variant="outline" onPress={() => { showView('members'); setFilter('failed') }}>{`${failedAsks} ${plural(failedAsks, 'позиция', 'позиции', 'позиций')} с ошибкой`}</Button>}
            {otherAsks > 0 && <Button size="sm" variant="outline" onPress={() => setShowAsks(true)}>{`ещё ${otherAsks}: найти поставщика или контакт`}</Button>}
            <Button variant="ghost" size="sm" onPress={() => setShowAsks(value => !value)}>{showAsks ? 'Свернуть' : 'По позициям'}</Button>
          </div>
        </div>
        {showAsks && <ul className="pr-campaign-asks__list">
          {asks.map(ask => <li key={ask.key} className={ask.blocking ? 'is-blocked' : undefined}>
            {ask.blocking ? <CircleAlert size={13} /> : <Clock size={13} />}
            <Link to={ask.to}>{ask.title}</Link>
            <span>#{ask.cardId}</span>
            <b>{ask.text}</b>
          </li>)}
          {threadRows.filter(thread => thread.automationPaused && thread.status !== 'READY').map(thread => <li key={thread.assignmentId}>
            <Clock size={13} />
            <Link to={`/procurement/negotiations/${thread.assignmentId}`}>{thread.supplierName || thread.assignmentId}</Link>
            <span>#{thread.cardId}</span>
            <b>агент остановлен — закрыть или возобновить</b>
          </li>)}
        </ul>}
      </div>}

      {/* One list of positions, read five ways: a mode unfolds what it is
          about and folds the rest, and a person can open anything by hand
          after that. The two blocks below the table stay until the modes
          have been tested by the people who use them. */}
      <div className="pr-view-switch" role="group" aria-label="Что раскрыть в таблице">
        {/* Every mode always, so the switch never changes shape; one with
            nothing to show opens every position on its section. */}
        {MODES.map(([id, label]) => <button
          key={id}
          type="button"
          aria-pressed={view === id}
          className={view === id ? 'is-on' : undefined}
          onClick={() => showView(id)}
        >
          {/* The approval counts what waits, and nothing waiting is no number. */}
          {label}{modeCounts[id] != null && !(id === 'review' && !modeCounts[id]) && <b>{modeCounts[id]}</b>}
          {modeAlerts[id] && <span className="pr-view-switch__alert">{modeAlerts[id]}</span>}
        </button>)}
      </div>

      {/* The presses that act on the whole purchase, above the table in the
          mode they belong to, so the rows below stay about one position. */}
      {(view === 'review' || view === 'all' || review.posted || review.dispatched || review.apply.error) && reviewData && <div className="pr-mode-toolbar">
        <p className="pr-note">Кому пишем и что спрашиваем — по каждой позиции. Компании и тексты RFQ уже отмечены по рекомендации: проверьте, снимите лишнее и нажмите «Согласовать» внизу. Кандидат становится поставщиком только с этим подтверждением.</p>
        <ReviewAlerts review={review} />
        <IdentitySummary review={review} anchor={cardId => `#member-${cardId}`} />
        <BulkVerdicts review={review} scope={review.items} />
      </div>}
      {(view === 'review' || view === 'all') && review.query.isLoading && <p className="pr-note">Загружаем согласование…</p>}
      {threadsOnTop && <div className="pr-mode-toolbar">{conversationsIntro}{conversationsToolbar}</div>}
      {marketplaceOnTop && <div className="pr-mode-toolbar">{marketplaceIntro}{marketplaceSummary}{marketplaceToolbar}</div>}

      <CampaignMembers
        campaign={campaign}
        members={members}
        stageLabels={MEMBER_STAGE}
        marketplaceLabels={MARKETPLACE_STATUS}
        threadStatusLabels={THREAD_STATUS}
        conversationsByCard={conversationsByCard}
        marketplaceByCard={marketplaceByCard}
        offersByCard={offersByCard}
        offersLoading={offers.isLoading}
        canRemove={canResearchSourcing && campaign.status !== 'CANCELLED'}
        canResearch={canResearchSourcing && campaign.status !== 'CANCELLED'}
        onResearch={(cardIds, done) => research.mutate(cardIds, { onSuccess: done })}
        researchPending={research.isPending}
        removable={member => removable(member, campaign)}
        onRemove={cardId => removeCard.mutate(cardId)}
        removePending={removeCard.isPending}
        filter={filter}
        onFilterChange={setFilter}
        renderMarketplaceActions={marketplaceActions}
        renderMarketplaceDetails={marketplaceDetails}
        renderMarketplaceStatus={marketplaceBadge}
        mode={view}
        review={reviewData ? review : null}
        reviewLoading={review.query.isLoading && review.query.fetchStatus !== 'idle'}
        onReviewWanted={() => setReviewWanted(true)}
        browserAccess={canOperateEchemi ? <EchemiBrowserAccess
          access={browser.data}
          error={browser.error}
          loading={browser.isLoading}
          compact
          brief
        /> : null}
      />
      {reviewData && (view === 'review' || view === 'all' || review.touched) && <ReviewBar review={review} />}

      {hasMarketplace && <details className="pr-more-details">
        <summary>{`Заявки на площадку (${marketplaceItems.length})`}{marketplaceNeedsReview > 0 ? ` · ${marketplaceNeedsReview} требует внимания` : ''}</summary>
        <div className="pr-stack">
      {marketplaceCard}

        </div>
      </details>}

      {conversations.length > 0 && <details className="pr-more-details">
        <summary>{`Все переписки закупки (${threadTotal})`}{awaitingPerson > 0 ? ` · ${awaitingPerson} ${plural(awaitingPerson, 'ждёт', 'ждут', 'ждут')} отправки` : ''}</summary>
        <div className="pr-stack">
      {conversationsCard}

        </div>
      </details>}

      {/* The approval page it came from, kept until the approval in the
          positions has been tried; the same decisions, on the same state. */}
      <details className="pr-more-details">
        <summary>Согласование на отдельной странице</summary>
        <div className="pr-stack">
          <p className="pr-note">То же согласование, что в режиме «Согласование» выше, одним списком на отдельной странице. Останется, пока новый вид не проверен.</p>
          <div className="pr-inline-actions"><RouterLinkButton variant="outline" to={`/procurement/campaigns/${campaignId}/review`}>Открыть страницу согласования</RouterLinkButton></div>
        </div>
      </details>

      {/* What explains the run rather than asks for anything: kept, one click
          away, so the page opens on what needs a person and what came in. The
          companies come first: they are something to fix; the history is not. */}
      {unreachable.length > 0 && <details className="pr-more-details">
        <summary>{`Компании без адреса (${unreachable.reduce((total, entry) => total + entry.suppliers.length, 0)})`}</summary>
        <div className="pr-stack">
      <Card><CardHeader><div>
        <CardTitle>Некому написать</CardTitle>
        <p>Эти компании вы подтвердили, но поиск не нашёл у них адреса в разрешённых каналах{channelsLabel ? ` (${channelsLabel})` : ''}. Допишите контакт на карточке поставщика — и запустите рассылку ещё раз.</p>
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
      </CardContent></Card>
        </div>
      </details>}

      <details className="pr-more-details">
        <summary>История закупки</summary>
        <div className="pr-stack">
          <CampaignHistory events={campaign.events || []} members={members} />
        </div>
      </details>
    </div>
  </DetailLayout>
}
