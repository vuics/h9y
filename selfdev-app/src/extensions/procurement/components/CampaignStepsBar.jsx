import React from 'react'

import { MEMBER_STEPS, SIDE_STEPS, STEP_FILTER, stepOfFilter, stepsBeyondReach } from '../lib/memberSteps'

/** The purchase's steps with how many positions stand on each. Pressing one shows
 * its positions; pressing it again shows them all. The counts stay whatever is
 * shown, since they describe the purchase and not the list. */
export function CampaignStepsBar({ counts, plan, filter, onFilterChange }) {
  const selected = stepOfFilter(filter)
  const beyond = stepsBeyondReach(plan)
  const press = step => onFilterChange(selected === step ? 'all' : `${STEP_FILTER}${step}`)
  const tone = (step, { count, waiting }) => {
    if (!count) return beyond.has(step) ? 'is-off' : 'is-empty'
    if (waiting) return 'is-waiting'
    if (step === 'result') return 'is-priced'
    if (step === 'failed') return 'is-failed'
    if (step === 'skipped') return 'is-empty'
    return 'is-working'
  }
  const button = ([step, label]) => {
    const entry = counts[step]
    const classes = ['pr-steps__step', tone(step, entry), selected === step ? 'is-on' : ''].filter(Boolean).join(' ')
    return <button
      type="button"
      className={classes}
      aria-pressed={selected === step}
      disabled={!entry.count && selected !== step}
      title={entry.waiting ? `${label}: ${entry.waiting} ждут вас` : `Показать: ${label}`}
      onClick={() => press(step)}
    >
      <span>{label}</span>
      <b>{entry.count}</b>
    </button>
  }
  const side = SIDE_STEPS.filter(([step]) => counts[step].count > 0 || selected === step)
  return <nav className="pr-steps" aria-label="Этапы закупки">
    <ol>{MEMBER_STEPS.map(entry => <li key={entry[0]}>{button(entry)}</li>)}</ol>
    {side.length > 0 && <ul>{side.map(entry => <li key={entry[0]}>{button(entry)}</li>)}</ul>}
  </nav>
}
