/** The top of the manager's screen: what is in flight, and what waits on a person.
 *
 * The rest of the dashboard looks back over a period. These two look at now,
 * and sit first because they are the ones a head of sourcing acts on: a review
 * queue in the thousands is the bottleneck of the whole system, and it used to
 * be a grey footnote under the traffic light.
 */

import React from 'react'
import { Link } from 'react-router-dom'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CampaignStatusBadge } from './CampaignStatusBadge'
import { CircleAlert } from './icons'
import { percent, plural, share, stackSegments } from '../lib/dashboard'

/** The pipeline stages on the ordinal blue ramp, light to dark in stage order;
 *  the three stages that mean something else keep their status colours. */
const STAGE_COLORS = {
  QUEUED: 'color-mix(in oklch, var(--chart-ordinal-1) 55%, var(--background))',
  SOURCING: 'var(--chart-ordinal-1)',
  CONTACTS: 'var(--chart-ordinal-2)',
  OUTREACH: 'var(--chart-ordinal-3)',
  NEGOTIATION: 'var(--chart-ordinal-4)',
  AWAITING_REVIEW: 'var(--pr-warn, #fab219)',
  DONE: 'var(--pr-good, #0ca30c)',
  FAILED: 'var(--pr-bad, #d03b3b)',
  SKIPPED: 'var(--pr-muted)',
}

/** One line across the page, shown only when people are the bottleneck. */
export function ReviewBacklogBanner({ supplyBase, portfolio }) {
  const candidates = supplyBase?.awaitingReview || 0
  const candidateTotal = supplyBase?.candidateTotal || 0
  const positions = portfolio?.waitingForPerson || 0
  if (!candidates && !positions) return null
  return (
    <div className="pr-review-banner" role="status">
      <CircleAlert aria-hidden="true" />
      <div>
        <strong>Ждут решения специалиста</strong>
        <span>
          {candidates > 0 && (
            <>
              <b>{candidates}</b> из {candidateTotal}{' '}
              {plural(candidateTotal, 'найденного кандидата', 'найденных кандидатов', 'найденных кандидатов')}
              {candidateTotal ? ` (${percent(candidates / candidateTotal)})` : ''}
            </>
          )}
          {candidates > 0 && positions > 0 && ' · '}
          {positions > 0 && (
            <>
              <b>{positions}</b> {plural(positions, 'позиция', 'позиции', 'позиций')} в закупках стоит на согласовании
            </>
          )}
        </span>
        <small>
          Это работа, которая ждёт человека, а не агента: пока решения нет, кандидат
          не становится поставщиком и запрос ему не уходит.
        </small>
      </div>
      <Link to="/procurement/campaigns" className="pr-review-banner__link">К закупкам</Link>
    </div>
  )
}

function StageBar({ stages, label }) {
  const segments = stackSegments(stages)
  return (
    <div className="pr-stackbar" role="img" aria-label={label}>
      {segments.map(segment => (
        <i
          key={segment.stage}
          title={`${segment.label}: ${segment.count}`}
          style={{ width: `${segment.share}%`, background: STAGE_COLORS[segment.stage] }}
        />
      ))}
    </div>
  )
}

function CampaignRow({ row }) {
  const href = row.waiting
    ? `/procurement/campaigns/${row.campaignId}/review`
    : `/procurement/campaigns/${row.campaignId}`
  const failed = row.failed || 0
  return (
    <li className="pr-portfolio__row">
      <div className="pr-portfolio__title">
        <Link to={href}>{row.title || row.campaignId}</Link>
        <CampaignStatusBadge status={row.status} />
      </div>
      <div
        className="pr-portfolio__progress"
        role="img"
        aria-label={`Готово ${row.done} из ${row.members}, ждут специалиста ${row.waiting}, в работе ${row.inFlight}`}
      >
        <i style={{ width: `${share(row.done, row.members)}%`, background: STAGE_COLORS.DONE }} />
        <i style={{ width: `${share(row.waiting, row.members)}%`, background: STAGE_COLORS.AWAITING_REVIEW }} />
        <i style={{ width: `${share(row.inFlight, row.members)}%`, background: STAGE_COLORS.OUTREACH }} />
        <i style={{ width: `${share(failed, row.members)}%`, background: STAGE_COLORS.SKIPPED }} />
      </div>
      <div className="pr-portfolio__meta">
        <span><b>{row.done}</b> из {row.members} готово</span>
        {row.waiting > 0 && <span className="pr-portfolio__waiting"><b>{row.waiting}</b> ждут специалиста</span>}
        <span>ответов {row.responses}</span>
      </div>
    </li>
  )
}

/** Purchases in flight: how many, how big, where their substances stand. */
export function PortfolioCard({ data }) {
  const statuses = data?.statuses || []
  const stages = data?.stages || []
  const campaigns = data?.campaigns || []
  const closed = (data?.total || 0) - (data?.active || 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Закупки в работе</CardTitle>
        <CardAction><Link to="/procurement/campaigns">Все закупки</Link></CardAction>
        <p className="pr-muted">
          Сейчас, а не за период. Сверху — закупки, где позиции ждут специалиста.
        </p>
      </CardHeader>
      <CardContent>
        {!data?.total ? (
          <p className="pr-funnel__foot">Закупок ещё не было. Запустите первую из списка позиций.</p>
        ) : (
          <div className="pr-portfolio">
            <div className="pr-portfolio__totals">
              <div><b>{data.active}</b><span>{plural(data.active, 'закупка идёт', 'закупки идут', 'закупок идёт')}</span></div>
              <div><b>{data.positions}</b><span>{plural(data.positions, 'позиция', 'позиции', 'позиций')} в них</span></div>
              <div data-warn={data.waitingForPerson ? 'true' : undefined}>
                <b>{data.waitingForPerson}</b><span>ждут специалиста</span>
              </div>
              <div><b>{closed}</b><span>{plural(closed, 'закрыта', 'закрыты', 'закрыто')} ранее</span></div>
            </div>

            {stages.length > 0 && (
              <>
                <StageBar
                  stages={stages}
                  label={stages.map(row => `${row.label}: ${row.count}`).join(', ')}
                />
                <ul className="pr-legend">
                  {stages.map(row => (
                    <li key={row.stage}>
                      <i style={{ background: STAGE_COLORS[row.stage] }} />
                      {row.label} <b>{row.count}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {campaigns.length > 0 && (
              <ul className="pr-portfolio__list">
                {campaigns.map(row => <CampaignRow key={row.campaignId} row={row} />)}
              </ul>
            )}
            {data.active > campaigns.length && (
              <p className="pr-chart-note">
                Показаны {campaigns.length} из {data.active}.{' '}
                <Link to="/procurement/campaigns">Остальные — в списке закупок</Link>.
              </p>
            )}
            {statuses.length > 0 && (
              <p className="pr-chart-note">
                Всего закупок {data.total}: {statuses.map(row => `${row.label.toLowerCase()} ${row.count}`).join(', ')}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
