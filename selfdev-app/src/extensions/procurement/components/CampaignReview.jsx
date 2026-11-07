import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'

import { StatusBadge } from './StatusBadge'
import { webOfferPrice, webOfferStock } from './WebOffers'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { plural } from './SourcingSettings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Check, ChevronDown, ChevronRight, CircleAlert, ExternalLink, Refresh } from './icons'
import {
  DECISION_LABEL, MARKETPLACE_SKIPPED, VERDICTS, suggestedVerdict,
  blockedText, dispatchProblems, dispatchTitle, mutationMessage, verdictKey,
} from '../lib/campaignReview'

/** The parts of a campaign's approval, drawn in the purchase page's positions
 * and its «Согласование» mode. Each takes `review`, the state of
 * `useCampaignReview`, so a decision made in one is the same decision in the
 * other.
 */

/** What the last press answered, and what this person may not do. */
export function ReviewAlerts({ review }) {
  const { apply, prepare, identity, posted, dispatched, canReviewSourcing } = review
  return <>
    {apply.error && <Alert><AlertTriangle /><AlertTitle>Согласование не применено</AlertTitle><AlertDescription>{mutationMessage(apply.error)}</AlertDescription></Alert>}
    {prepare.error && <Alert><AlertTriangle /><AlertTitle>Не удалось подготовить RFQ</AlertTitle><AlertDescription>{mutationMessage(prepare.error)}</AlertDescription></Alert>}
    {!canReviewSourcing && <Alert><AlertTriangle /><AlertTitle>Согласование доступно только для чтения</AlertTitle><AlertDescription>Для подтверждения кандидатов требуется разрешение SOURCING_REVIEW.</AlertDescription></Alert>}
    {posted && <Alert>{posted.started ? <Check /> : <CircleAlert />}<AlertTitle>{posted.started ? 'Заявки на площадку выставляются' : 'Заявки на площадку не начаты'}</AlertTitle><AlertDescription>
      {posted.started
        ? <>Заявки уходят по одной через общий браузер — это минуты на вещество. Ход видно на странице закупки.</>
        : MARKETPLACE_SKIPPED[posted.skipped] || posted.message || posted.skipped}
    </AlertDescription></Alert>}
    {dispatched && <Alert className={dispatchProblems(dispatched).length > 0 ? 'pr-alert--warning' : undefined}>{dispatched.queued > 0 ? <Check /> : <CircleAlert />}<AlertTitle>{dispatchTitle(dispatched)}</AlertTitle><AlertDescription>
      {dispatched.queued > 0 && <p>Закупка перешла к рассылке — ход видно на странице закупки.</p>}
      {dispatched.skipped === 'NEGOTIATION_QUEUE_REQUIRED' && <p>Решения записаны, но отправка требует разрешения NEGOTIATION_QUEUE. Запросы уйдут, когда её запустит сотрудник с этим правом.</p>}
      {dispatchProblems(dispatched).length > 0 && <ul className="pr-plain-list">{dispatchProblems(dispatched).map((problem, index) => <li key={index}><Link to={`/procurement/requests/${problem.cardId}`}>#{problem.cardId}</Link>{problem.supplier && <> · {problem.supplierId
        // The supplier's record, where its site and contacts are and where the
        // missing address is added.
        ? <Link to={`/procurement/suppliers/${problem.supplierId}`}>{problem.supplier}</Link>
        : problem.supplier}</>} — {blockedText(problem.code)}</li>)}</ul>}
    </AlertDescription></Alert>}
    {prepare.data?.failed?.length > 0 && <Alert><CircleAlert /><AlertTitle>RFQ подготовлен не по всем веществам</AlertTitle><AlertDescription><ul className="pr-plain-list">{prepare.data.failed.map(item => <li key={item.cardId}><Link to={`/procurement/requests/${item.cardId}`}>#{item.cardId}</Link> — {blockedText(item.code)}</li>)}</ul></AlertDescription></Alert>}
    {identity.error && <Alert><AlertTriangle /><AlertTitle>Не удалось</AlertTitle><AlertDescription>{mutationMessage(identity.error)}</AlertDescription></Alert>}
    {identity.data?.failed?.length > 0 && <Alert><CircleAlert /><AlertTitle>Не по всем веществам получилось</AlertTitle><AlertDescription><ul className="pr-plain-list">{identity.data.failed.map(item => <li key={item.cardId}><Link to={`/procurement/requests/${item.cardId}`}>#{item.cardId}</Link> — {item.message}</li>)}</ul></AlertDescription></Alert>}
  </>
}

/** The substances whose identity is unsettled, settled in bulk where safe. */
export function IdentitySummary({ review }) {
  const { identityItems, confirmable, identity, canWriteCards } = review
  if (!identityItems.length) return null
  const busy = identity.isPending
  const title = `Идентичность не подтверждена: ${identityItems.length} ${plural(identityItems.length, 'вещество', 'вещества', 'веществ')}`
  const text = <p>RFQ пишется только для вещества, чьи CAS и название подтвердил PubChem или специалист. Перепроверка исправит то, что система теперь распознаёт сама (обрезанные названия, пометки в скобках). Подтверждение фиксирует, что CAS и название в карточке верны, — под вашим именем. Вещества, где CAS противоречит названию, подтверждаются только по одному.</p>
  const body = <>
    {canWriteCards && <div className="pr-inline-actions">
      <Button isDisabled={busy} onPress={() => identity.mutate({ action: 'recheck', cardIds: identityItems.map(item => item.cardId) })}><Refresh className={busy ? 'pr-spin' : undefined} />{busy ? 'Проверяем…' : `Перепроверить в PubChem (${identityItems.length})`}</Button>
      {confirmable.length > 0 && <Button variant="outline" isDisabled={busy} onPress={() => identity.mutate({ action: 'confirm', cardIds: confirmable.map(item => item.cardId) })}>Подтвердить как в карточке ({confirmable.length})</Button>}
    </div>}
    <ul className="pr-plain-list">{identityItems.map(item => <li key={item.cardId}><a href={`#member-${item.cardId}`}>#{item.cardId} {item.title}</a> — {item.normalization.casMatches === false ? 'CAS не совпадает с названием' : 'название не совпадает с PubChem'}</li>)}</ul>
  </>
  return <div className="pr-review-identity-summary"><strong>{title}</strong>{text}{body}</div>
}

/** One choice for every undecided company of the scope: a substance, or all. */
export function BulkVerdicts({ review, scope }) {
  const { openTargets, setAll, suggestAll, apply, canReviewSourcing } = review
  const targets = openTargets(scope)
  if (!canReviewSourcing || !targets.length) return null
  const reachable = targets.filter(([, candidate]) => candidate.contactCount).length
  const busy = apply.isPending
  return <div className="pr-review-bulk">
    <span className="pr-muted">Всем нерешённым ({targets.length}):</span>
    {reachable > 0 && <Button size="sm" isDisabled={busy} onPress={() => setAll(scope, 'PRICE_REQUEST', { withContactsOnly: true })}>Запросить цену у всех с контактами ({reachable})</Button>}
    {VERDICTS.map(([value, label]) => <Button key={value} size="sm" variant="outline" isDisabled={busy} onPress={() => setAll(scope, value)}>{label}</Button>)}
    <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => suggestAll(scope)}>По рекомендации</Button>
  </div>
}

/** The two presses that act on the whole approval: write the missing RFQs, and apply. */
export function ReviewActions({ review, scope = null }) {
  const { missingRfqs, prepare, apply, canReviewSourcing, canWriteCards } = review
  const { decisions, candidateCount, rfqCount } = scopedDecisions(review, scope)
  return <>
    {missingRfqs > 0 && canWriteCards && !scope && <Button variant="outline" isDisabled={prepare.isPending} onPress={() => prepare.mutate()}><Refresh className={prepare.isPending ? 'pr-spin' : undefined} />{prepare.isPending ? 'Готовим…' : `Подготовить RFQ (${missingRfqs})`}</Button>}
    {canReviewSourcing && <Button isDisabled={!decisions.length || apply.isPending} onPress={() => apply.mutate(decisions)}><Check />{apply.isPending ? 'Применяем…' : `Согласовать: ${candidateCount} ${plural(candidateCount, 'решение', 'решения', 'решений')} по компаниям и ${rfqCount} RFQ`}</Button>}
  </>
}

function VerdictRadios({ review, item, candidate }) {
  const { verdicts, choose, apply, canReviewSourcing } = review
  const key = verdictKey(item.cardId, candidate.candidateId)
  const decided = candidate.reviewDecision !== 'UNREVIEWED'
  const current = verdicts[key] ?? (decided ? candidate.reviewDecision : undefined)
  return <div className="pr-review-verdicts">{VERDICTS.map(([value, label]) => {
    const suggestion = suggestedVerdict(candidate)
    const suggested = !decided && suggestion.value === value
    const concluded = suggestion.reason === 'рекомендую'
    return <label key={value}>
      <input
        type="radio"
        // Scoped to the substance: the same company id repeats across blocks.
        name={`verdict-${item.cardId}-${candidate.candidateId}`}
        aria-label={`${candidate.name}: ${label}`}
        checked={current === value}
        disabled={!canReviewSourcing || apply.isPending}
        onChange={() => choose(key, value)}
      />
      <span>{label}</span>
      {suggested && (concluded
        ? <em className="pr-review-suggested">рекомендую</em>
        : <em className="pr-review-suggested pr-review-suggested--unknown">{suggestion.reason}</em>)}
    </label>
  })}</div>
}

const bestOfferLine = offers => {
  const best = offers[0]
  // Bulk packs come last, so a bag leads only where it is all the seller has.
  return [webOfferPrice(best), best.pack, best.bulk && 'крупная фасовка', webOfferStock(best)].filter(Boolean).join(' · ') + (offers.length > 1 ? ` · ещё ${offers.length - 1}` : '')
}

const CONTACT_LIMIT = 4

const contactHref = contact => {
  if (contact.channel === 'email') return `mailto:${contact.address}`
  if (contact.channel === 'phone' || contact.channel === 'whatsapp') return `tel:${contact.address.replace(/[^\d+]/g, '')}`
  return /^https?:\/\//.test(contact.address) ? contact.address : null
}

/** The addresses a request would go to, so "нет контакта" after sending is
 * seen before it, under the company it is about. */
function CandidateContacts({ candidate }) {
  const contacts = candidate.contacts
  if (!contacts) return candidate.contactCount || <span className="pr-import-missing">нет</span>
  if (!contacts.length) return <span className="pr-import-missing">нет</span>
  const shown = contacts.slice(0, CONTACT_LIMIT)
  return <ul className="pr-plain-list pr-candidate-contacts">{shown.map((contact, index) => {
    const href = contactHref(contact)
    const label = CONTACT_CHANNEL_LABEL[contact.channel] || contact.channel
    return <li key={index} title={contact.sourceUrl || undefined}><span className="pr-primary-meta">{label}</span> {href ? <a href={href} target="_blank" rel="noreferrer">{contact.address}</a> : contact.address}</li>
  })}{contacts.length > shown.length && <li className="pr-primary-meta">ещё {contacts.length - shown.length}</li>}</ul>
}

const CONTACT_CHANNEL_LABEL = { email: 'почта', phone: 'тел.', whatsapp: 'WhatsApp', web_form: 'форма' }

function CandidateTable({ review, item, candidates, editable, scroll = false }) {
  const table = <table className={scroll ? 'pr-table pr-review-candidates pr-member-review__candidates' : 'pr-table pr-review-candidates'}><thead><tr>
    <th>Компания</th><th>Оценка</th><th>Контакты</th><th>Решение</th>
  </tr></thead><tbody>{candidates.map(candidate => <tr key={candidate.candidateId}>
    <td>
      <strong>{candidate.name}</strong>
      <div className="pr-primary-meta">{candidate.country || '—'}{candidate.productPage && <> · <a href={candidate.productPage.url} target="_blank" rel="noreferrer" title={candidate.productPage.quote}><ExternalLink size={12} />{candidate.productPage.ownSite ? 'страница вещества' : `вещество на ${candidate.productPage.domain}`}</a></>}{candidate.website && <> · <a href={candidate.website} target="_blank" rel="noreferrer"><ExternalLink size={12} />сайт</a></>}{candidate.promotedSupplierId && <> · <Link to={`/procurement/suppliers/${candidate.promotedSupplierId}`}>в справочнике</Link></>}</div>
      {candidate.webOffers?.[0] && <div className="pr-candidate-offer">{bestOfferLine(candidate.webOffers)}</div>}
      {editable && candidate.signals.length > 0 && <ul className="pr-review-signals">{candidate.signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>}
      {editable && candidate.risks.length > 0 && <ul className="pr-review-signals pr-review-signals--risk">{candidate.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
    </td>
    <td><StatusBadge status={candidate.preliminaryStatus} label={`${candidate.score}/100`} /></td>
    <td><CandidateContacts candidate={candidate} /></td>
    <td>{editable ? <VerdictRadios review={review} item={item} candidate={candidate} /> : <StatusBadge status={candidate.reviewDecision} label={DECISION_LABEL[candidate.reviewDecision]} />}</td>
  </tr>)}</tbody></table>
  // Inside a position it is drawn like the offers above it, and scrolls on its
  // own when narrower than its columns.
  return scroll ? <div className="pr-table-wrap pr-member-review__scroll">{table}</div> : table
}

function IdentityBlock({ review, item }) {
  const { identity, canWriteCards } = review
  const n = item.normalization
  const busy = identity.isPending
  return <div className="pr-review-identity">
    <strong>Идентичность вещества не подтверждена — без неё RFQ не готовится</strong>
    <ul className="pr-plain-list">{n.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
    {n.preferredName && <p className="pr-note">PubChem по этому CAS: «{n.preferredName}».{n.suggestedCas && <> По названию PubChem даёт CAS <strong>{n.suggestedCas}</strong>.</>}</p>}
    {canWriteCards && <div className="pr-inline-actions">
      {n.suggestedCas && <Button size="sm" isDisabled={busy} onPress={() => identity.mutate({ action: 'replaceCas', cardIds: [item.cardId], cas: n.suggestedCas })}>Заменить CAS на {n.suggestedCas}</Button>}
      <Button size="sm" variant="outline" isDisabled={busy} onPress={() => identity.mutate({ action: 'confirm', cardIds: [item.cardId] })}>{n.casMatches === false ? 'Оставить CAS как в карточке' : 'Подтвердить как в карточке'}</Button>
      <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => identity.mutate({ action: 'recheck', cardIds: [item.cardId] })}>Перепроверить в PubChem</Button>
    </div>}
  </div>
}

const WRITTEN_TO = new Set(['VERIFIED_MANUFACTURER', 'VERIFIED_DISTRIBUTOR', 'PRICE_REQUEST'])

/** Everything one substance asks to be approved, drawn the way the purchase
 * page draws a position:
 * two parts, companies and RFQ, each under a one-line header that names it,
 * says where it stands in coloured labels and carries its own way out to the
 * page that goes deeper. The decided companies fold like a section does.
 */
export function ReviewItem({ review, item }) {
  const { appliedById, revising, setRevising, opened, setOpened, rfqs, tickRfq, apply, canWriteCards } = review
  const result = appliedById.get(item.cardId)
  const open = item.candidates.filter(candidate => candidate.reviewDecision === 'UNREVIEWED')
  const decided = item.candidates.filter(candidate => candidate.reviewDecision !== 'UNREVIEWED')
  const approved = decided.filter(candidate => WRITTEN_TO.has(candidate.reviewDecision)).length
  const folded = !revising[item.cardId]
  const rfq = item.rfq
  const rfqBadge = rfq?.status === 'APPROVED'
    ? <StatusBadge status="complete" tone="complete" label="согласован" compact />
    : rfq?.documentFingerprint
      ? <StatusBadge status="warning" tone="warning" label="ждёт согласования" compact />
      : <StatusBadge status="muted" tone="muted" label="не подготовлен" compact />
  return <div className="pr-pos-review">
    {result && <Alert>{result.errors?.length ? <CircleAlert /> : <Check />}<AlertTitle>{result.errors?.length ? 'Применено частично' : 'Применено'}</AlertTitle><AlertDescription>
      Подтверждено {result.verified?.length ?? 0}, стало поставщиками {result.promoted?.length ?? 0}{result.rfqApproved ? ', RFQ согласован' : ''}.
      {result.errors?.length > 0 && <ul className="pr-plain-list">{result.errors.map((error, index) => <li key={index}>{error.candidateId ? `${error.candidateId}: ` : ''}{error.message}</li>)}</ul>}
    </AlertDescription></Alert>}

    {item.normalization && <IdentityBlock review={review} item={item} />}

    <div className="pr-pos-review__part">
      <div className="pr-pos-review__head">
        <b>Компании</b>
        {open.length > 0 && !item.blockedBy && <StatusBadge status="warning" tone="warning" label={`${open.length} на решении`} compact />}
        {approved > 0 && <StatusBadge status="complete" tone="complete" label={`подтверждено: ${approved}`} compact />}
        {!item.candidates.length && <span className="pr-pos-review__muted">{item.blockedBy ? blockedText(item.blockedBy) : 'кандидатов нет'}</span>}
        <RouterLinkButton className="pr-pos-review__out" size="sm" variant="ghost" to={`/procurement/requests/${item.cardId}/sourcing`}><ExternalLink size={13} />Поиск</RouterLinkButton>
      </div>
      {open.length > 0 && <BulkVerdicts review={review} scope={[item]} />}
      {open.length > 0 && <CandidateTable review={review} item={item} candidates={open} editable scroll />}
      {decided.length > 0 && <div className="pr-pos-review__fold">
        <button type="button" className="pr-pos-review__fold-head" aria-expanded={!folded} onClick={() => setRevising(current => ({ ...current, [item.cardId]: !current[item.cardId] }))}>
          {folded ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span>Принятые решения ({decided.length})</span>
          <span className="pr-pos-review__muted">{folded ? 'показать и изменить' : 'свернуть'}</span>
        </button>
        {!folded && <>
          {item.stage === 'OUTREACH' || item.stage === 'NEGOTIATION'
            ? <p className="pr-note">Запросы по этому веществу уже ушли. Новая роль или новый поставщик учтутся дальше, но уже отправленное письмо не отзывается.</p>
            : null}
          <CandidateTable review={review} item={item} candidates={decided} editable scroll />
        </>}
      </div>}
    </div>

    {rfq && <div className="pr-pos-review__part">
      <div className="pr-pos-review__head">
        <b>RFQ</b>
        {rfqBadge}
        {rfq.editedAt && <span className="pr-pos-review__muted" title="Текст правили вручную, а не система">изменён вручную {new Date(rfq.editedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
        {/* A fold, drawn like the escalation's «Решить»: the chevron says
            whether the letter is open. */}
        {rfq.subject && <button
          type="button"
          className="pr-supplier-line__toggle pr-pos-review__out"
          aria-expanded={Boolean(opened[item.cardId])}
          onClick={() => setOpened(current => ({ ...current, [item.cardId]: !current[item.cardId] }))}
        >{opened[item.cardId] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}Текст{rfq.status !== 'APPROVED' && rfq.documentFingerprint
          && (!review.rfqWasSeen(rfq.documentFingerprint, 'english') || (rfq.russian && !review.rfqWasSeen(rfq.documentFingerprint, 'russian')))
          && <i className="pr-review-rfq__unread" aria-label="есть непрочитанный текст" />}</button>}
        <RouterLinkButton className={rfq.subject ? undefined : 'pr-pos-review__out'} size="sm" variant="ghost" to={`/procurement/requests/${item.cardId}/rfq`}><ExternalLink size={13} />RFQ</RouterLinkButton>
        {/* Last: the one thing on the line that may be cut short. */}
        {rfq.subject && <span className="pr-pos-review__subject" title={rfq.subject}>{rfq.subject}</span>}
      </div>
      {opened[item.cardId] && rfq.bodyMarkdown && <RfqText review={review} item={item} rfq={rfq} />}
      {rfq.status !== 'APPROVED' && (rfq.documentFingerprint
        ? <label className="pr-pos-review__approve">
          <input
            type="checkbox"
            checked={Boolean(rfqs[item.cardId])}
            aria-label={`Согласовать RFQ по веществу ${item.title}`}
            disabled={!canWriteCards || apply.isPending}
            onChange={event => tickRfq(item.cardId, event.target.checked)}
          />
          <span>{rfq.russian ? 'Согласовать оба текста: English и Русский' : 'Согласовать этот текст'}</span>
        </label>
        : <p className="pr-note">{item.normalization ? 'RFQ появится, когда идентичность вещества будет подтверждена.' : 'RFQ ещё не подготовлен — «Подготовить RFQ» на панели внизу.'}</p>)}
    </div>}
  </div>
}

const RFQ_VERSIONS = [['english', 'English'], ['russian', 'Русский']]

/** Both letters of a position's RFQ, each editable where it is read. A Moscow
 * shop gets the Russian one, so it is approved as much as the English. Saving
 * changes the card's RFQ for every letter still to go, and withdraws its
 * approval: the tick below then approves the new wording. */
function RfqText({ review, item, rfq }) {
  const queryClient = useQueryClient()
  const [shown, setShown] = useState('english')
  const [draft, setDraft] = useState(null)
  const versions = {
    english: { subject: rfq.subject, bodyMarkdown: rfq.bodyMarkdown },
    russian: rfq.russian,
  }
  const current = versions[shown]
  const fingerprint = rfq.documentFingerprint
  const { markRfqSeen, rfqWasSeen } = review
  useEffect(() => {
    if (fingerprint && current) markRfqSeen(fingerprint, shown)
  }, [fingerprint, shown, current, markRfqSeen])
  // Lit only while there is something to approve: once approved, unread is history.
  const unread = name => rfq.status !== 'APPROVED' && fingerprint && !rfqWasSeen(fingerprint, name)
  const save = useMutation({
    mutationFn: () => procurementApi.editRFQ(item.cardId, {
      [shown]: { subject: draft.subject, bodyMarkdown: draft.bodyMarkdown },
    }),
    onSuccess: () => {
      setDraft(null)
      queryClient.invalidateQueries({ queryKey: procurementKeys.campaignReview(review.campaignId) })
    },
  })
  const pick = name => { setShown(name); setDraft(null); save.reset() }
  return <div className="pr-review-rfq">
    <div className="pr-review-rfq__tabs" role="tablist" aria-label="Версия RFQ">
      {RFQ_VERSIONS.filter(([name]) => versions[name]).map(([name, label]) => <button
        key={name} type="button" role="tab" aria-selected={shown === name}
        className={shown === name ? 'is-on' : undefined}
        disabled={save.isPending}
        onClick={() => pick(name)}
        title={unread(name) ? 'Ещё не открывали — согласование одобрит и этот текст' : undefined}
      >{label}{unread(name) && <i className="pr-review-rfq__unread" aria-label="не просмотрено" />}</button>)}
      {review.canWriteCards && !draft && current && <Button size="sm" variant="ghost" onPress={() => setDraft({ ...current })}>Править</Button>}
    </div>
    {draft
      ? <div className="pr-review-rfq__edit">
        <input aria-label="Тема письма" value={draft.subject || ''} onChange={event => setDraft({ ...draft, subject: event.target.value })} />
        <textarea aria-label="Текст запроса" rows={14} value={draft.bodyMarkdown || ''} onChange={event => setDraft({ ...draft, bodyMarkdown: event.target.value })} />
        <p className="pr-note">Правка заменит RFQ этой позиции для всех следующих писем; уже отправленные не меняются. После сохранения RFQ снова ждёт согласования.</p>
        {save.error && <p className="pr-note" role="alert">Не сохранено: {mutationMessage(save.error)}</p>}
        <div className="pr-inline-actions">
          <Button size="sm" isDisabled={save.isPending || !draft.subject?.trim() || !draft.bodyMarkdown?.trim()} onPress={() => save.mutate()}>{save.isPending ? 'Сохраняем…' : 'Сохранить'}</Button>
          <Button size="sm" variant="ghost" isDisabled={save.isPending} onPress={() => { setDraft(null); save.reset() }}>Отмена</Button>
        </div>
      </div>
      : current && <pre className="pr-review-rfq__body">{current.bodyMarkdown}</pre>}
  </div>
}

/** The approval's two presses, pinned to the bottom of the screen while there
 * is something to send: on a purchase of twenty-eight substances the button at
 * the top is a long way back from the last company decided.
 */
/** Only the decisions of the positions in `scope` (card ids), when given: from
 * the positions table that is the approvals a person has opened, so a press
 * never sends a recommendation on a position nobody looked at. */
export const scopedDecisions = (review, scope) => {
  const decisions = scope ? review.decisions.filter(decision => scope.includes(decision.cardId)) : review.decisions
  return {
    decisions,
    candidateCount: decisions.reduce((total, item) => total + item.candidates.length, 0),
    rfqCount: decisions.filter(item => item.rfqFingerprint).length,
  }
}

export function ReviewBar({ review, scope = null }) {
  const { missingRfqs, touched, reset, apply } = review
  const { decisions, candidateCount, rfqCount } = scopedDecisions(review, scope)
  if (!decisions.length && (!missingRfqs || scope)) return null
  return <div className="pr-review-bar" role="region" aria-label="Согласование закупки">
    <span>{decisions.length
      ? <>{scope ? `По ${scope.length} ${plural(scope.length, 'открытой позиции', 'открытым позициям', 'открытым позициям')}: ` : 'К согласованию: '}<b>{candidateCount}</b> {plural(candidateCount, 'решение', 'решения', 'решений')} по компаниям и <b>{rfqCount}</b> RFQ{touched ? '' : ' — по рекомендации'}</>
      : 'Решений к отправке нет'}</span>
    <div className="pr-inline-actions">
      {touched && !scope && <Button variant="ghost" isDisabled={apply.isPending} onPress={reset}>Вернуть рекомендации</Button>}
      <ReviewActions review={review} scope={scope} />
    </div>
  </div>
}
