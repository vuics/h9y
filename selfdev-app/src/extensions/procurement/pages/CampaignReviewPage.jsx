import React, { useMemo, useState } from 'react'
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
const SUGGESTED = {
  MANUFACTURER: 'VERIFIED_MANUFACTURER',
  BOTH: 'VERIFIED_MANUFACTURER',
  DISTRIBUTOR: 'VERIFIED_DISTRIBUTOR',
}

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
    },
  })

  // Memoised because the empty-array fallback is a fresh value on every render,
  // which would make every derived list below recompute for nothing.
  const items = useMemo(() => query.data?.items || [], [query.data?.items])
  const actionable = useMemo(() => items.filter(item => !item.blockedBy), [items])

  const decisions = useMemo(() => actionable.map(item => {
    const candidates = item.candidates
      .filter(candidate => verdicts[candidate.candidateId])
      .map(candidate => ({
        candidateId: candidate.candidateId,
        decision: verdicts[candidate.candidateId],
      }))
    const fingerprint = rfqs[item.cardId] ? item.rfq?.documentFingerprint : null
    return { cardId: item.cardId, candidates, ...(fingerprint ? { rfqFingerprint: fingerprint } : {}) }
  }).filter(decision => decision.candidates.length || decision.rfqFingerprint), [actionable, verdicts, rfqs])

  // Counted separately from the substances: "Согласовать (1)" on a page where
  // one substance carries a candidate verdict and an RFQ approval reads as one
  // decision when it is two, and the operator is about to send both.
  const decisionCount = useMemo(
    () => decisions.reduce(
      (total, item) => total + item.candidates.length + (item.rfqFingerprint ? 1 : 0),
      0,
    ),
    [decisions],
  )

  const acceptAllSuggested = () => {
    const next = {}
    const nextRfqs = {}
    for (const item of actionable) {
      for (const candidate of item.candidates) {
        if (candidate.reviewDecision !== 'UNREVIEWED') continue
        const suggested = SUGGESTED[candidate.role]
        // Only where the evidence actually concluded something. A candidate
        // whose role is unknown is exactly the one a person has to look at,
        // so "accept all" deliberately leaves it blank rather than guessing.
        if (suggested) next[candidate.candidateId] = suggested
      }
      if (item.rfq?.documentFingerprint && item.rfq.status !== 'APPROVED') nextRfqs[item.cardId] = true
    }
    setVerdicts(next)
    setRfqs(nextRfqs)
  }

  if (query.isLoading) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />
  const review = query.data
  if (!review) return <EmptyState title="Кампания не найдена" />

  const missingRfqs = actionable.filter(item => item.rfq && item.rfq.status === 'NOT_PREPARED').length
  const appliedById = new Map((applied || []).map(result => [result.cardId, result]))

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
    </>}
  >
    <div className="pr-stack">
      <Card><CardHeader><div>
        <CardTitle>Одно решение на всю кампанию</CardTitle>
        <p>Кому пишем и что спрашиваем — по каждому веществу. Кандидат становится поставщиком только с явным подтверждением, а RFQ согласуется по тому тексту, который показан здесь.</p>
      </div></CardHeader><CardContent>
        <div className="pr-inline-actions">
          {missingRfqs > 0 && canWriteCards && <Button variant="outline" isDisabled={prepare.isPending} onPress={() => prepare.mutate()}><Refresh className={prepare.isPending ? 'pr-spin' : undefined} />{prepare.isPending ? 'Готовим…' : `Подготовить RFQ (${missingRfqs})`}</Button>}
          {canReviewSourcing && <Button variant="outline" onPress={acceptAllSuggested}>Принять предложенное</Button>}
          {canReviewSourcing && <Button isDisabled={!decisions.length || apply.isPending} onPress={() => apply.mutate(decisions)}><Check />{apply.isPending ? 'Применяем…' : `Согласовать: ${decisionCount} ${plural(decisionCount, 'решение', 'решения', 'решений')} по ${decisions.length} ${plural(decisions.length, 'веществу', 'веществам', 'веществам')}`}</Button>}
        </div>
        <p className="pr-note">«Принять предложенное» отмечает роль, к которой пришли доказательства, и только там, где они к чему-то пришли: кандидат с неопределённой ролью остаётся пустым, потому что именно его и надо посмотреть глазами.</p>
      </CardContent></Card>

      {items.length === 0 && <EmptyState title="В кампании нет веществ" />}

      {items.map(item => {
        const result = appliedById.get(item.cardId)
        return <Card key={item.cardId} className="pr-review-block"><CardHeader><div>
          <CardTitle>{item.title}</CardTitle>
          <p>
            <CopyableId value={item.cardId} displayValue={`#${item.cardId}`} to={`/procurement/requests/${item.cardId}`} />
            {' · CAS '}{item.casNumber || 'не указан'}
            {' · '}<Link to={`/procurement/requests/${item.cardId}/sourcing`}>поиск кандидатов</Link>
          </p>
        </div>{item.blockedBy
          ? <Badge variant="outline">{blockedText(item.blockedBy)}</Badge>
          : <Badge variant="secondary">{item.candidates.length} кандидатов</Badge>}
        </CardHeader><CardContent>
          {result && <Alert>{result.errors?.length ? <CircleAlert /> : <Check />}<AlertTitle>{result.errors?.length ? 'Применено частично' : 'Применено'}</AlertTitle><AlertDescription>
            Подтверждено {result.verified?.length ?? 0}, стало поставщиками {result.promoted?.length ?? 0}{result.rfqApproved ? ', RFQ согласован' : ''}.
            {result.errors?.length > 0 && <ul className="pr-plain-list">{result.errors.map((error, index) => <li key={index}>{error.candidateId ? `${error.candidateId}: ` : ''}{error.message}</li>)}</ul>}
          </AlertDescription></Alert>}

          {item.blockedBy
            ? <p className="pr-note">Это вещество пока нельзя согласовать: {blockedText(item.blockedBy)}. <Link to={`/procurement/requests/${item.cardId}`}>Открыть карточку</Link></p>
            : <>
              {item.candidates.length === 0
                ? <p className="pr-note">Поиск не нашёл кандидатов. <Link to={`/procurement/requests/${item.cardId}/sourcing`}>Открыть поиск</Link></p>
                : <table className="pr-table pr-review-candidates"><thead><tr>
                  <th>Компания</th><th>Оценка</th><th>Контакты</th><th>Решение</th>
                </tr></thead><tbody>{item.candidates.map(candidate => <tr key={candidate.candidateId}>
                  <td>
                    <strong>{candidate.name}</strong>
                    <div className="pr-primary-meta">{candidate.country || '—'}{candidate.website && <> · <a href={candidate.website} target="_blank" rel="noreferrer"><ExternalLink size={12} />сайт</a></>}</div>
                    {candidate.signals.length > 0 && <ul className="pr-review-signals">{candidate.signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>}
                    {candidate.risks.length > 0 && <ul className="pr-review-signals pr-review-signals--risk">{candidate.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
                  </td>
                  <td><StatusBadge status={candidate.preliminaryStatus} label={`${candidate.score}/100`} /></td>
                  <td>{candidate.contactCount || <span className="pr-import-missing">нет</span>}</td>
                  <td>{candidate.reviewDecision !== 'UNREVIEWED'
                    ? <StatusBadge status={candidate.reviewDecision} />
                    : <div className="pr-review-verdicts">{VERDICTS.map(([value, label]) => <label key={value}>
                      <input
                        type="radio"
                        name={`verdict-${candidate.candidateId}`}
                        // Named in full because the page holds dozens of these
                        // and a reader hearing only "Производитель" would have
                        // no idea which company the verdict lands on.
                        aria-label={`${candidate.name}: ${label}`}
                        checked={verdicts[candidate.candidateId] === value}
                        disabled={!canReviewSourcing || apply.isPending}
                        onChange={() => setVerdicts(current => ({ ...current, [candidate.candidateId]: value }))}
                      />
                      <span>{label}</span>
                    </label>)}</div>}</td>
                </tr>)}</tbody></table>}

              <div className="pr-review-rfq">
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
                    : <p className="pr-note">RFQ ещё не подготовлен — нажмите «Подготовить RFQ» наверху.</p>}
              </div>
            </>}
        </CardContent></Card>
      })}
    </div>
  </DetailLayout>
}
