import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { DetailLayout } from '../components/DetailLayout'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { StatusBadge } from '../components/StatusBadge'
import { CopyableId } from '../components/CopyableId'
import { plural } from '../components/SourcingSettings'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Check, CircleAlert, ExternalLink, Refresh } from '../components/icons'

/** The one approval a campaign asks for.
 *
 * Both halves of the same question — who do we write to, and what do we ask
 * them — on one page, one block per substance. The gates behind it are
 * unchanged: a candidate is verified with an explicit verdict, and an RFQ is
 * approved against the fingerprint of the document displayed here. What this
 * screen removes is the two hundred page loads, not the decision.
 */

const VERDICTS = [
  ['VERIFIED_MANUFACTURER', 'Производитель'],
  ['VERIFIED_DISTRIBUTOR', 'Дистрибьютор'],
  ['NEEDS_MORE_EVIDENCE', 'Нужны доказательства'],
  ['REJECTED', 'Отклонить'],
]

// What the evidence already concluded, offered as the default verdict. The
// operator confirms or overrides it; nothing is submitted without them picking.
//
// `UNKNOWN` is a statement about our evidence, not about the company: the role
// extractor did not settle it, and on this campaign that is 51 of 121 rows —
// BOC Sciences, Lookchem, Fisher Scientific among them. So it defaults to
// "needs evidence" rather than to a rejection. The two are identical in what
// they permit — `require_promotable_candidate` writes to a supplier only on
// VERIFIED_MANUFACTURER or VERIFIED_DISTRIBUTOR — and differ only in whether a
// real company is thrown away on no grounds, recorded under the specialist's
// own name. A verdict can be revised later; only the way back to UNREVIEWED is
// closed.
const SUGGESTED = {
  MANUFACTURER: 'VERIFIED_MANUFACTURER',
  BOTH: 'VERIFIED_MANUFACTURER',
  DISTRIBUTOR: 'VERIFIED_DISTRIBUTOR',
  UNKNOWN: 'NEEDS_MORE_EVIDENCE',
}

// Only where the evidence actually concluded something. The rest are parked,
// and the row has to say so: marking all 121 "рекомендую" would erase the one
// distinction the screen exists to preserve — where there is a finding and
// where there is only an absence — and turn the preselect from saved clicks
// into a way to record decisions nobody read.
const CONCLUDED = new Set(['MANUFACTURER', 'BOTH', 'DISTRIBUTOR'])

/** One decision is a candidate *under one substance*, never a candidate.
 *
 * The same company found for several substances carries the same
 * `SRC-CAND-…` id in every one of them — on this campaign 14 of 99 ids repeat
 * across the four blocks. Keyed by the id alone, one verdict stood for three
 * separate decisions and, because the radio `name` collided too, picking a
 * role for Dayang Chem under one substance visibly cleared it under another.
 */
const verdictKey = (cardId, candidateId) => `${cardId}:${candidateId}`

const BLOCKED_LABEL = {
  STAGE_QUEUED: 'ещё не искали',
  STAGE_SOURCING: 'поиск ещё идёт',
  STAGE_CONTACTS: 'собираем контакты',
  STAGE_DONE: 'этот запуск не предполагал рассылку',
  STAGE_SKIPPED: 'пропущено',
  STAGE_FAILED: 'поиск не удался',
  CARD_INCOMPLETE: 'карточка — черновик, не хватает полей',
  RFQ_NOT_READY: 'карточка не нормализована',
  CARD_NOT_FOUND: 'карточка не найдена',
  SOURCING_ENGINE_UNAVAILABLE: 'ни один движок поиска не доступен',
  SOURCING_NOT_READY: 'поиск по карточке ещё не готов',
  CARD_NOT_NORMALIZED: 'карточка не нормализована',
  NO_USABLE_CONTACT: 'у поставщика нет контакта в разрешённых каналах кампании',
  STAGE_OUTREACH: 'запросы уже отправлены',
  STAGE_NEGOTIATION: 'идут переговоры',
}

const RFQ_STATUS = {
  NOT_PREPARED: 'не подготовлен',
  PREPARED: 'подготовлен, не согласован',
  APPROVED: 'согласован',
}

const mutationMessage = error => error?.response?.data?.message || error?.message
const blockedText = code => BLOCKED_LABEL[code] || code

const DECISION_LABEL = Object.fromEntries(VERDICTS)

// Said when the specialist vouches from this screen. Required by the API, and
// true: they confirmed the card's own CAS and name against what PubChem showed.
const CONFIRM_REASON = 'Подтверждено специалистом при согласовании кампании: CAS и название в карточке верны.'

/** Every reason a substance was not written to, flattened for one list.
 *
 * Per substance rather than as one count: "не отправлено по 3" tells the
 * specialist there is a problem and nothing about which substance has it.
 */
const dispatchProblems = outreach => (outreach.results || []).flatMap(result =>
  (result.errors || []).map(error => ({ cardId: result.cardId, code: error.code })))

const dispatchTitle = outreach => {
  if (outreach.queued > 0) return `Запросы отправлены: ${outreach.queued}`
  if (outreach.skipped === 'NEGOTIATION_QUEUE_REQUIRED') return 'Решения записаны, отправка ждёт прав'
  if (outreach.skipped === 'REACH_BELOW_OUTREACH') return 'Этот запуск не предполагал рассылку'
  return 'Отправлять было нечего'
}

/** Why the marketplace requests did or did not start on this approval.
 *
 * Reported rather than assumed: posting goes through one shared browser and
 * runs behind the response, so the approval screen can only say that it
 * started — the campaign page is where it is watched.
 */
const MARKETPLACE_SKIPPED = {
  ECHEMI_NOT_IN_PLAN: 'Канал Echemi при запуске не выбирали — заявки на площадку по этой кампании не выставляются.',
  ECHEMI_OPERATE_REQUIRED: 'Заявки на площадку требуют разрешения ECHEMI_OPERATE. Решения записаны; выставить их сможет сотрудник с этим правом — со страницы кампании.',
  BUYER_DELIVERY_INCOMPLETE: 'Заявки на площадку не начаты: в настройках закупщика не хватает условий поставки. Заполните их и запустите со страницы кампании.',
}

export default function CampaignReviewPage() {
  const { campaignId } = useParams()
  const queryClient = useQueryClient()
  const { canReviewSourcing, canWriteCards } = useProcurementPermissions()

  // `verdicts` is keyed by candidate id, `rfqs` by card id. Held here rather
  // than per block so that "Согласовать всё" is one submission and a reload
  // never leaves half the decisions applied and half on screen.
  const [verdicts, setVerdicts] = useState({})
  const [rfqs, setRfqs] = useState({})
  const [opened, setOpened] = useState({})
  // Decided candidates are folded per substance; unfolding is how a past
  // verdict is changed, and applying folds them again.
  const [revising, setRevising] = useState({})
  const [applied, setApplied] = useState(null)
  const [dispatched, setDispatched] = useState(null)
  const [posted, setPosted] = useState(null)

  const query = useQuery({
    queryKey: procurementKeys.campaignReview(campaignId),
    queryFn: ({ signal }) => procurementApi.campaignReview(campaignId, signal),
  })

  const accept = data => {
    queryClient.setQueryData(procurementKeys.campaignReview(campaignId), data)
    queryClient.invalidateQueries({ queryKey: procurementKeys.campaign(campaignId) })
  }
  const prepare = useMutation({
    mutationFn: () => procurementApi.prepareCampaignRfqs(campaignId),
    onSuccess: accept,
  })
  const apply = useMutation({
    mutationFn: decisions => procurementApi.applyCampaignReview(campaignId, decisions),
    onSuccess: data => {
      accept(data)
      setApplied(data.results || [])
      setDispatched(data.outreach || null)
      setPosted(data.marketplace || null)
      setVerdicts({})
      setRfqs({})
      setRevising({})
    },
  })
  // Settling the identity of several cards at once, then writing the RFQs that
  // were waiting on it: an RFQ is written only for a confirmed identity, so the
  // two are one step for the person, not two buttons.
  const identity = useMutation({
    mutationFn: async ({ action, cardIds, cas }) => {
      const failed = []
      for (const cardId of cardIds) {
        try {
          if (action === 'recheck') await procurementApi.normalizeCard(cardId)
          if (action === 'confirm') await procurementApi.confirmCardNormalization(cardId, CONFIRM_REASON)
          if (action === 'replaceCas') {
            await procurementApi.updateCard(cardId, { cas_number: cas })
            await procurementApi.normalizeCard(cardId)
          }
        } catch (error) {
          failed.push({ cardId, message: mutationMessage(error) })
        }
      }
      const prepared = canWriteCards
        ? await procurementApi.prepareCampaignRfqs(campaignId).catch(() => null)
        : null
      return { failed, prepared }
    },
    onSuccess: ({ prepared }) => {
      if (prepared) accept(prepared)
      else queryClient.invalidateQueries({ queryKey: procurementKeys.campaignReview(campaignId) })
    },
  })

  // Memoised because the empty-array fallback is a fresh value on every render,
  // which would make every derived list below recompute for nothing.
  const items = useMemo(() => query.data?.items || [], [query.data?.items])
  const actionable = useMemo(() => items.filter(item => !item.blockedBy), [items])
  const identityItems = useMemo(() => items.filter(item => item.normalization), [items])

  // Over every substance, not only those waiting: a verdict on a substance
  // whose letters have gone can still be corrected, and a company left
  // undecided there can still be written to.
  const decisions = useMemo(() => items.map(item => {
    const candidates = item.candidates
      .filter(candidate => {
        const chosen = verdicts[verdictKey(item.cardId, candidate.candidateId)]
        return chosen && chosen !== candidate.reviewDecision
      })
      .map(candidate => ({
        candidateId: candidate.candidateId,
        decision: verdicts[verdictKey(item.cardId, candidate.candidateId)],
      }))
    const fingerprint = rfqs[item.cardId] && item.rfq?.status !== 'APPROVED' ? item.rfq?.documentFingerprint : null
    return { cardId: item.cardId, candidates, ...(fingerprint ? { rfqFingerprint: fingerprint } : {}) }
  }).filter(decision => decision.candidates.length || decision.rfqFingerprint), [items, verdicts, rfqs])

  // Counted separately from the substances: "Согласовать (1)" on a page where
  // one substance carries a candidate verdict and an RFQ approval reads as one
  // decision when it is two, and the operator is about to send both.
  const candidateCount = decisions.reduce((total, item) => total + item.candidates.length, 0)
  const rfqCount = decisions.filter(item => item.rfqFingerprint).length

  // The suggestion is the starting position, not a hidden default: the dots
  // arrive already on what the evidence concluded, so the specialist spends
  // their time on the rows they disagree with instead of re-entering the ones
  // they agree with. Only rows the evidence actually concluded something about
  // are filled — an unknown role is precisely the one that needs a human, so
  // it stays blank. Seeded into `verdicts` rather than painted on at render
  // time so that the counter on "Согласовать" and what is submitted are the
  // same thing the operator can see.
  useEffect(() => {
    if (!items.length) return
    setVerdicts(current => {
      const next = { ...current }
      let changed = false
      for (const item of items) {
        for (const candidate of item.candidates) {
          if (candidate.reviewDecision !== 'UNREVIEWED') continue
          const key = verdictKey(item.cardId, candidate.candidateId)
          if (key in next) continue
          const suggested = SUGGESTED[candidate.role]
          if (!suggested) continue
          next[key] = suggested
          changed = true
        }
      }
      return changed ? next : current
    })
    // A prepared RFQ starts ticked, like the companies: the button names how
    // many texts it approves, every text is one click from being read, and an
    // untick is remembered. Seeded once per card so a reload of the data never
    // re-ticks what the specialist unticked.
    setRfqs(current => {
      const next = { ...current }
      let changed = false
      for (const item of items) {
        if (item.cardId in next) continue
        if (!item.rfq?.documentFingerprint || item.rfq.status === 'APPROVED') continue
        next[item.cardId] = true
        changed = true
      }
      return changed ? next : current
    })
  }, [items])

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const review = query.data
  if (!review) return <EmptyState title="Кампания не найдена" />

  const missingRfqs = items.filter(item => item.rfq && item.rfq.status === 'NOT_PREPARED' && !item.normalization).length
  const appliedById = new Map((applied || []).map(result => [result.cardId, result]))
  // A CAS the name contradicts is never settled in bulk: that is the one case
  // where the letter would ask for the wrong substance.
  const confirmable = identityItems.filter(item => item.normalization.casMatches !== false)
  const identityBusy = identity.isPending

  const verdictRadios = (item, candidate) => {
    const key = verdictKey(item.cardId, candidate.candidateId)
    const decided = candidate.reviewDecision !== 'UNREVIEWED'
    const current = verdicts[key] ?? (decided ? candidate.reviewDecision : undefined)
    return <div className="pr-review-verdicts">{VERDICTS.map(([value, label]) => {
      const suggested = !decided && SUGGESTED[candidate.role] === value
      const concluded = CONCLUDED.has(candidate.role)
      return <label key={value}>
        <input
          type="radio"
          // Scoped to the substance: the same company id repeats across blocks.
          name={`verdict-${item.cardId}-${candidate.candidateId}`}
          aria-label={`${candidate.name}: ${label}`}
          checked={current === value}
          disabled={!canReviewSourcing || apply.isPending}
          onChange={() => setVerdicts(cur => ({ ...cur, [key]: value }))}
        />
        <span>{label}</span>
        {suggested && (concluded
          ? <em className="pr-review-suggested">рекомендую</em>
          : <em className="pr-review-suggested pr-review-suggested--unknown">нет данных</em>)}
      </label>
    })}</div>
  }

  const candidateRow = (item, candidate, editable) => <tr key={candidate.candidateId}>
    <td>
      <strong>{candidate.name}</strong>
      <div className="pr-primary-meta">{candidate.country || '—'}{candidate.website && <> · <a href={candidate.website} target="_blank" rel="noreferrer"><ExternalLink size={12} />сайт</a></>}{candidate.promotedSupplierId && <> · <Link to={`/procurement/suppliers/${candidate.promotedSupplierId}`}>в справочнике</Link></>}</div>
      {editable && candidate.signals.length > 0 && <ul className="pr-review-signals">{candidate.signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>}
      {editable && candidate.risks.length > 0 && <ul className="pr-review-signals pr-review-signals--risk">{candidate.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
    </td>
    <td><StatusBadge status={candidate.preliminaryStatus} label={`${candidate.score}/100`} /></td>
    <td>{candidate.contactCount || <span className="pr-import-missing">нет</span>}</td>
    <td>{editable ? verdictRadios(item, candidate) : <StatusBadge status={candidate.reviewDecision} label={DECISION_LABEL[candidate.reviewDecision]} />}</td>
  </tr>

  const candidateTable = (item, candidates, editable) => <table className="pr-table pr-review-candidates"><thead><tr>
    <th>Компания</th><th>Оценка</th><th>Контакты</th><th>Решение</th>
  </tr></thead><tbody>{candidates.map(candidate => candidateRow(item, candidate, editable))}</tbody></table>

  const identityBlock = item => {
    const n = item.normalization
    return <div className="pr-review-identity">
      <strong>Идентичность вещества не подтверждена — без неё RFQ не готовится</strong>
      <ul className="pr-plain-list">{n.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
      {n.preferredName && <p className="pr-note">PubChem по этому CAS: «{n.preferredName}».{n.suggestedCas && <> По названию PubChem даёт CAS <strong>{n.suggestedCas}</strong>.</>}</p>}
      {canWriteCards && <div className="pr-inline-actions">
        {n.suggestedCas && <Button size="sm" isDisabled={identityBusy} onPress={() => identity.mutate({ action: 'replaceCas', cardIds: [item.cardId], cas: n.suggestedCas })}>Заменить CAS на {n.suggestedCas}</Button>}
        <Button size="sm" variant="outline" isDisabled={identityBusy} onPress={() => identity.mutate({ action: 'confirm', cardIds: [item.cardId] })}>{n.casMatches === false ? 'Оставить CAS как в карточке' : 'Подтвердить как в карточке'}</Button>
        <Button size="sm" variant="ghost" isDisabled={identityBusy} onPress={() => identity.mutate({ action: 'recheck', cardIds: [item.cardId] })}>Перепроверить в PubChem</Button>
      </div>}
    </div>
  }

  return <DetailLayout
    backTo={`/procurement/campaigns/${campaignId}`}
    backLabel="К кампании"
    eyebrow={<CopyableId value={review.campaignId} />}
    title="Согласование кампании"
    status={<Badge variant="secondary">{review.pendingCandidates} на решении</Badge>}
    meta={`${review.title} · ${actionable.length} из ${items.length} веществ готовы к согласованию`}
    warnings={<>
      {apply.error && <Alert><AlertTriangle /><AlertTitle>Согласование не применено</AlertTitle><AlertDescription>{mutationMessage(apply.error)}</AlertDescription></Alert>}
      {prepare.error && <Alert><AlertTriangle /><AlertTitle>Не удалось подготовить RFQ</AlertTitle><AlertDescription>{mutationMessage(prepare.error)}</AlertDescription></Alert>}
      {!canReviewSourcing && <Alert><AlertTriangle /><AlertTitle>Согласование доступно только для чтения</AlertTitle><AlertDescription>Для подтверждения кандидатов требуется разрешение SOURCING_REVIEW.</AlertDescription></Alert>}
      {posted && <Alert>{posted.started ? <Check /> : <CircleAlert />}<AlertTitle>{posted.started ? 'Заявки на площадку выставляются' : 'Заявки на площадку не начаты'}</AlertTitle><AlertDescription>
        {posted.started
          ? <>Заявки уходят по одной через общий браузер — это минуты на вещество. Ход видно на странице кампании.</>
          : MARKETPLACE_SKIPPED[posted.skipped] || posted.message || posted.skipped}
      </AlertDescription></Alert>}
      {dispatched && <Alert>{dispatched.queued > 0 ? <Check /> : <CircleAlert />}<AlertTitle>{dispatchTitle(dispatched)}</AlertTitle><AlertDescription>
        {dispatched.queued > 0 && <p>Кампания перешла к рассылке — ход видно на странице кампании.</p>}
        {dispatched.skipped === 'NEGOTIATION_QUEUE_REQUIRED' && <p>Решения записаны, но отправка требует разрешения NEGOTIATION_QUEUE. Запросы уйдут, когда её запустит сотрудник с этим правом.</p>}
        {dispatchProblems(dispatched).length > 0 && <ul className="pr-plain-list">{dispatchProblems(dispatched).map((problem, index) => <li key={index}><Link to={`/procurement/requests/${problem.cardId}`}>#{problem.cardId}</Link> — {blockedText(problem.code)}</li>)}</ul>}
      </AlertDescription></Alert>}
      {prepare.data?.failed?.length > 0 && <Alert><CircleAlert /><AlertTitle>RFQ подготовлен не по всем веществам</AlertTitle><AlertDescription><ul className="pr-plain-list">{prepare.data.failed.map(item => <li key={item.cardId}><Link to={`/procurement/requests/${item.cardId}`}>#{item.cardId}</Link> — {blockedText(item.code)}</li>)}</ul></AlertDescription></Alert>}
      {identity.error && <Alert><AlertTriangle /><AlertTitle>Не удалось</AlertTitle><AlertDescription>{mutationMessage(identity.error)}</AlertDescription></Alert>}
      {identity.data?.failed?.length > 0 && <Alert><CircleAlert /><AlertTitle>Не по всем веществам получилось</AlertTitle><AlertDescription><ul className="pr-plain-list">{identity.data.failed.map(item => <li key={item.cardId}><Link to={`/procurement/requests/${item.cardId}`}>#{item.cardId}</Link> — {item.message}</li>)}</ul></AlertDescription></Alert>}
    </>}
  >
    <div className="pr-stack">
      {identityItems.length > 0 && <Card className="pr-review-identity-summary"><CardHeader><div>
        <CardTitle>Идентичность не подтверждена: {identityItems.length} {plural(identityItems.length, 'вещество', 'вещества', 'веществ')}</CardTitle>
        <p>RFQ пишется только для вещества, чьи CAS и название подтвердил PubChem или специалист. Перепроверка исправит то, что система теперь распознаёт сама (обрезанные названия, пометки в скобках). Подтверждение фиксирует, что CAS и название в карточке верны, — под вашим именем. Вещества, где CAS противоречит названию, подтверждаются только по одному.</p>
      </div></CardHeader><CardContent>
        {canWriteCards && <div className="pr-inline-actions">
          <Button isDisabled={identityBusy} onPress={() => identity.mutate({ action: 'recheck', cardIds: identityItems.map(item => item.cardId) })}><Refresh className={identityBusy ? 'pr-spin' : undefined} />{identityBusy ? 'Проверяем…' : `Перепроверить в PubChem (${identityItems.length})`}</Button>
          {confirmable.length > 0 && <Button variant="outline" isDisabled={identityBusy} onPress={() => identity.mutate({ action: 'confirm', cardIds: confirmable.map(item => item.cardId) })}>Подтвердить как в карточке ({confirmable.length})</Button>}
        </div>}
        <ul className="pr-plain-list">{identityItems.map(item => <li key={item.cardId}><a href={`#review-${item.cardId}`}>#{item.cardId} {item.title}</a> — {item.normalization.casMatches === false ? 'CAS не совпадает с названием' : 'название не совпадает с PubChem'}</li>)}</ul>
      </CardContent></Card>}

      <Card><CardHeader><div>
        <CardTitle>Одно решение на всю кампанию</CardTitle>
        <p>Кому пишем и что спрашиваем — по каждому веществу. Компании и тексты RFQ уже отмечены по рекомендации: проверьте, снимите лишнее и нажмите одну кнопку. Кандидат становится поставщиком только с этим подтверждением.</p>
      </div></CardHeader><CardContent>
        <div className="pr-inline-actions">
          {missingRfqs > 0 && canWriteCards && <Button variant="outline" isDisabled={prepare.isPending} onPress={() => prepare.mutate()}><Refresh className={prepare.isPending ? 'pr-spin' : undefined} />{prepare.isPending ? 'Готовим…' : `Подготовить RFQ (${missingRfqs})`}</Button>}
          {canReviewSourcing && <Button isDisabled={!decisions.length || apply.isPending} onPress={() => apply.mutate(decisions)}><Check />{apply.isPending ? 'Применяем…' : `Согласовать: ${candidateCount} ${plural(candidateCount, 'решение', 'решения', 'решений')} по компаниям и ${rfqCount} RFQ`}</Button>}
        </div>
      </CardContent></Card>

      {items.length === 0 && <EmptyState title="В кампании нет веществ" />}

      {items.map(item => {
        const result = appliedById.get(item.cardId)
        const open = item.candidates.filter(candidate => candidate.reviewDecision === 'UNREVIEWED')
        const decided = item.candidates.filter(candidate => candidate.reviewDecision !== 'UNREVIEWED')
        const hasRun = item.candidates.length > 0
        return <Card key={item.cardId} id={`review-${item.cardId}`} className="pr-review-block"><CardHeader><div>
          <CardTitle>{item.title}</CardTitle>
          <p>
            <CopyableId value={item.cardId} displayValue={`#${item.cardId}`} to={`/procurement/requests/${item.cardId}`} />
            {' · CAS '}{item.casNumber || 'не указан'}
            {' · '}<Link to={`/procurement/requests/${item.cardId}/sourcing`}>поиск кандидатов</Link>
          </p>
        </div>{item.blockedBy
          ? <Badge variant="outline">{blockedText(item.blockedBy)}</Badge>
          : <Badge variant="secondary">{open.length} на решении</Badge>}
        </CardHeader><CardContent>
          {result && <Alert>{result.errors?.length ? <CircleAlert /> : <Check />}<AlertTitle>{result.errors?.length ? 'Применено частично' : 'Применено'}</AlertTitle><AlertDescription>
            Подтверждено {result.verified?.length ?? 0}, стало поставщиками {result.promoted?.length ?? 0}{result.rfqApproved ? ', RFQ согласован' : ''}.
            {result.errors?.length > 0 && <ul className="pr-plain-list">{result.errors.map((error, index) => <li key={index}>{error.candidateId ? `${error.candidateId}: ` : ''}{error.message}</li>)}</ul>}
          </AlertDescription></Alert>}

          {item.normalization && identityBlock(item)}

          {!hasRun
            ? <p className="pr-note">{item.blockedBy ? <>Пока нечего согласовывать: {blockedText(item.blockedBy)}. </> : 'Поиск не нашёл кандидатов. '}<Link to={`/procurement/requests/${item.cardId}/sourcing`}>Открыть поиск</Link></p>
            : <>
              {open.length > 0 && candidateTable(item, open, true)}
              {decided.length > 0 && <div className="pr-review-decided">
                <button type="button" className="pr-review-rfq__toggle" onClick={() => setRevising(current => ({ ...current, [item.cardId]: !current[item.cardId] }))}>
                  {revising[item.cardId] ? 'Свернуть принятые решения' : `Принятые решения (${decided.length}) — показать и изменить`}
                </button>
                {revising[item.cardId] && <>
                  {item.stage === 'OUTREACH' || item.stage === 'NEGOTIATION'
                    ? <p className="pr-note">Запросы по этому веществу уже ушли. Новая роль или новый поставщик учтутся дальше, но уже отправленное письмо не отзывается.</p>
                    : null}
                  {candidateTable(item, decided, true)}
                </>}
              </div>}
            </>}

          {item.rfq && <div className="pr-review-rfq">
            <header>
              <strong>Запрос предложения (RFQ)</strong>
              <span>{RFQ_STATUS[item.rfq?.status] || item.rfq?.status || '—'}</span>
            </header>
            {item.rfq?.subject && <>
              <button type="button" className="pr-review-rfq__toggle" onClick={() => setOpened(current => ({ ...current, [item.cardId]: !current[item.cardId] }))}>
                {opened[item.cardId] ? 'Свернуть текст' : 'Показать текст'}
              </button>
              <p className="pr-review-rfq__subject">{item.rfq.subject}</p>
              {opened[item.cardId] && <pre className="pr-review-rfq__body">{item.rfq.bodyMarkdown}</pre>}
            </>}
            {item.rfq?.status === 'APPROVED'
              ? <p className="pr-note">Согласован. Изменение карточки или текста снимает согласование.</p>
              : item.rfq?.documentFingerprint
                ? <label className="pr-review-rfq__approve">
                  <input
                    type="checkbox"
                    checked={Boolean(rfqs[item.cardId])}
                    aria-label={`Согласовать RFQ по веществу ${item.title}`}
                    disabled={!canWriteCards || apply.isPending}
                    onChange={event => setRfqs(current => ({ ...current, [item.cardId]: event.target.checked }))}
                  />
                  <span>Согласовать этот текст</span>
                </label>
                : <p className="pr-note">{item.normalization ? 'RFQ появится, когда идентичность вещества будет подтверждена.' : 'RFQ ещё не подготовлен — нажмите «Подготовить RFQ» наверху.'}</p>}
          </div>}
        </CardContent></Card>
      })}
    </div>
  </DetailLayout>
}
