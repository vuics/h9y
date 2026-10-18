import React from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from './StatusBadge'
import { plural } from './SourcingSettings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Check, CircleAlert, ExternalLink, Refresh } from './icons'
import {
  CONCLUDED, DECISION_LABEL, MARKETPLACE_SKIPPED, RFQ_STATUS, SUGGESTED, VERDICTS,
  blockedText, dispatchProblems, dispatchTitle, mutationMessage, verdictKey,
} from '../lib/campaignReview'

/** The parts of a campaign's approval, for the approval page and the purchase
 * page alike. Each takes `review`, the state of `useCampaignReview`, so a
 * decision made in one is the same decision in the other.
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
    {dispatched && <Alert>{dispatched.queued > 0 ? <Check /> : <CircleAlert />}<AlertTitle>{dispatchTitle(dispatched)}</AlertTitle><AlertDescription>
      {dispatched.queued > 0 && <p>Закупка перешла к рассылке — ход видно на странице закупки.</p>}
      {dispatched.skipped === 'NEGOTIATION_QUEUE_REQUIRED' && <p>Решения записаны, но отправка требует разрешения NEGOTIATION_QUEUE. Запросы уйдут, когда её запустит сотрудник с этим правом.</p>}
      {dispatchProblems(dispatched).length > 0 && <ul className="pr-plain-list">{dispatchProblems(dispatched).map((problem, index) => <li key={index}><Link to={`/procurement/requests/${problem.cardId}`}>#{problem.cardId}</Link> — {blockedText(problem.code)}</li>)}</ul>}
    </AlertDescription></Alert>}
    {prepare.data?.failed?.length > 0 && <Alert><CircleAlert /><AlertTitle>RFQ подготовлен не по всем веществам</AlertTitle><AlertDescription><ul className="pr-plain-list">{prepare.data.failed.map(item => <li key={item.cardId}><Link to={`/procurement/requests/${item.cardId}`}>#{item.cardId}</Link> — {blockedText(item.code)}</li>)}</ul></AlertDescription></Alert>}
    {identity.error && <Alert><AlertTriangle /><AlertTitle>Не удалось</AlertTitle><AlertDescription>{mutationMessage(identity.error)}</AlertDescription></Alert>}
    {identity.data?.failed?.length > 0 && <Alert><CircleAlert /><AlertTitle>Не по всем веществам получилось</AlertTitle><AlertDescription><ul className="pr-plain-list">{identity.data.failed.map(item => <li key={item.cardId}><Link to={`/procurement/requests/${item.cardId}`}>#{item.cardId}</Link> — {item.message}</li>)}</ul></AlertDescription></Alert>}
  </>
}

/** The substances whose identity is unsettled, settled in bulk where safe.
 * A card on the approval page, a plain block in the purchase page's strip.
 */
export function IdentitySummary({ review, card = false, anchor = cardId => `#review-${cardId}` }) {
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
    <ul className="pr-plain-list">{identityItems.map(item => <li key={item.cardId}><a href={anchor(item.cardId)}>#{item.cardId} {item.title}</a> — {item.normalization.casMatches === false ? 'CAS не совпадает с названием' : 'название не совпадает с PubChem'}</li>)}</ul>
  </>
  if (card) {
    return <Card className="pr-review-identity-summary"><CardHeader><div>
      <CardTitle>{title}</CardTitle>
      {text}
    </div></CardHeader><CardContent>{body}</CardContent></Card>
  }
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
export function ReviewActions({ review }) {
  const { missingRfqs, prepare, apply, decisions, candidateCount, rfqCount, canReviewSourcing, canWriteCards } = review
  return <>
    {missingRfqs > 0 && canWriteCards && <Button variant="outline" isDisabled={prepare.isPending} onPress={() => prepare.mutate()}><Refresh className={prepare.isPending ? 'pr-spin' : undefined} />{prepare.isPending ? 'Готовим…' : `Подготовить RFQ (${missingRfqs})`}</Button>}
    {canReviewSourcing && <Button isDisabled={!decisions.length || apply.isPending} onPress={() => apply.mutate(decisions)}><Check />{apply.isPending ? 'Применяем…' : `Согласовать: ${candidateCount} ${plural(candidateCount, 'решение', 'решения', 'решений')} по компаниям и ${rfqCount} RFQ`}</Button>}
  </>
}

function VerdictRadios({ review, item, candidate }) {
  const { verdicts, choose, apply, canReviewSourcing } = review
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
        onChange={() => choose(key, value)}
      />
      <span>{label}</span>
      {suggested && (concluded
        ? <em className="pr-review-suggested">рекомендую</em>
        : <em className="pr-review-suggested pr-review-suggested--unknown">нет данных</em>)}
    </label>
  })}</div>
}

function CandidateTable({ review, item, candidates, editable }) {
  return <table className="pr-table pr-review-candidates"><thead><tr>
    <th>Компания</th><th>Оценка</th><th>Контакты</th><th>Решение</th>
  </tr></thead><tbody>{candidates.map(candidate => <tr key={candidate.candidateId}>
    <td>
      <strong>{candidate.name}</strong>
      <div className="pr-primary-meta">{candidate.country || '—'}{candidate.website && <> · <a href={candidate.website} target="_blank" rel="noreferrer"><ExternalLink size={12} />сайт</a></>}{candidate.promotedSupplierId && <> · <Link to={`/procurement/suppliers/${candidate.promotedSupplierId}`}>в справочнике</Link></>}</div>
      {editable && candidate.signals.length > 0 && <ul className="pr-review-signals">{candidate.signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>}
      {editable && candidate.risks.length > 0 && <ul className="pr-review-signals pr-review-signals--risk">{candidate.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
    </td>
    <td><StatusBadge status={candidate.preliminaryStatus} label={`${candidate.score}/100`} /></td>
    <td>{candidate.contactCount || <span className="pr-import-missing">нет</span>}</td>
    <td>{editable ? <VerdictRadios review={review} item={item} candidate={candidate} /> : <StatusBadge status={candidate.reviewDecision} label={DECISION_LABEL[candidate.reviewDecision]} />}</td>
  </tr>)}</tbody></table>
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

/** Everything one substance asks to be approved: its identity, its companies,
 * the companies already decided, and its RFQ — with the way to the search and
 * the RFQ pages when `links` is set.
 */
export function ReviewItem({ review, item, links = false }) {
  const { appliedById, revising, setRevising, opened, setOpened, rfqs, tickRfq, apply, canWriteCards } = review
  const result = appliedById.get(item.cardId)
  const open = item.candidates.filter(candidate => candidate.reviewDecision === 'UNREVIEWED')
  const decided = item.candidates.filter(candidate => candidate.reviewDecision !== 'UNREVIEWED')
  const hasRun = item.candidates.length > 0
  return <>
    {links && <p className="pr-review-links">
      <Link to={`/procurement/requests/${item.cardId}/sourcing`}>Поиск и кандидаты</Link>
      <Link to={`/procurement/requests/${item.cardId}/rfq`}>RFQ</Link>
    </p>}
    {result && <Alert>{result.errors?.length ? <CircleAlert /> : <Check />}<AlertTitle>{result.errors?.length ? 'Применено частично' : 'Применено'}</AlertTitle><AlertDescription>
      Подтверждено {result.verified?.length ?? 0}, стало поставщиками {result.promoted?.length ?? 0}{result.rfqApproved ? ', RFQ согласован' : ''}.
      {result.errors?.length > 0 && <ul className="pr-plain-list">{result.errors.map((error, index) => <li key={index}>{error.candidateId ? `${error.candidateId}: ` : ''}{error.message}</li>)}</ul>}
    </AlertDescription></Alert>}

    {item.normalization && <IdentityBlock review={review} item={item} />}

    {!hasRun
      ? <p className="pr-note">{item.blockedBy ? <>Пока нечего согласовывать: {blockedText(item.blockedBy)}. </> : 'Поиск не нашёл кандидатов. '}<Link to={`/procurement/requests/${item.cardId}/sourcing`}>Открыть поиск</Link></p>
      : <>
        {open.length > 0 && <BulkVerdicts review={review} scope={[item]} />}
        {open.length > 0 && <CandidateTable review={review} item={item} candidates={open} editable />}
        {decided.length > 0 && <div className="pr-review-decided">
          <button type="button" className="pr-review-rfq__toggle" onClick={() => setRevising(current => ({ ...current, [item.cardId]: !current[item.cardId] }))}>
            {revising[item.cardId] ? 'Свернуть принятые решения' : `Принятые решения (${decided.length}) — показать и изменить`}
          </button>
          {revising[item.cardId] && <>
            {item.stage === 'OUTREACH' || item.stage === 'NEGOTIATION'
              ? <p className="pr-note">Запросы по этому веществу уже ушли. Новая роль или новый поставщик учтутся дальше, но уже отправленное письмо не отзывается.</p>
              : null}
            <CandidateTable review={review} item={item} candidates={decided} editable />
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
              onChange={event => tickRfq(item.cardId, event.target.checked)}
            />
            <span>Согласовать этот текст</span>
          </label>
          : <p className="pr-note">{item.normalization ? 'RFQ появится, когда идентичность вещества будет подтверждена.' : 'RFQ ещё не подготовлен — нажмите «Подготовить RFQ» наверху.'}</p>}
    </div>}
  </>
}

/** The approval's two presses, pinned to the bottom of the screen while there
 * is something to send: on a purchase of twenty-eight substances the button at
 * the top is a long way back from the last company decided.
 */
export function ReviewBar({ review }) {
  const { decisions, missingRfqs, candidateCount, rfqCount, touched, reset, apply } = review
  if (!decisions.length && !missingRfqs) return null
  return <div className="pr-review-bar" role="region" aria-label="Согласование закупки">
    <span>{decisions.length
      ? <>К согласованию: <b>{candidateCount}</b> {plural(candidateCount, 'решение', 'решения', 'решений')} по компаниям и <b>{rfqCount}</b> RFQ{touched ? '' : ' — по рекомендации'}</>
      : 'Решений к отправке нет'}</span>
    <div className="pr-inline-actions">
      {touched && <Button variant="ghost" isDisabled={apply.isPending} onPress={reset}>Вернуть рекомендации</Button>}
      <ReviewActions review={review} />
    </div>
  </div>
}
