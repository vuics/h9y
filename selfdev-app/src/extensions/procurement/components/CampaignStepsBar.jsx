import React from 'react'

import { MEMBER_STEPS, SIDE_STEPS, STEP_FILTER, stepOfFilter, stepSquares, stepsBeyondReach } from '../lib/memberSteps'

const SQUARE_LABEL = { waiting: 'ждёт вас', plain: 'позиция', again: 'ищем заново', elsewhere: 'ищем заново, позиция на своём этапе' }

const stepTitle = (label, step, { count, waiting, again }) => [
  `${label}: ${count}`,
  waiting ? `${waiting} ждут вас` : '',
  again ? (step === 'search' ? `ещё ${again} ищем заново` : `${again} ищем заново`) : '',
].filter(Boolean).join(' · ')

/** A square per position on the step, so its share of the purchase is seen
 * before its number is read. Filled: on this step; amber: waiting for you;
 * pulsing: searched again; hollow, on the search step: searched again while
 * the position stands further on. */
function Squares({ step, entry }) {
  const { kinds, more } = stepSquares(entry)
  const elsewhere = step === 'search' ? Math.min(entry.again, 18 - Math.min(kinds.length, 18)) : 0
  const all = [...kinds, ...Array(elsewhere).fill('elsewhere')]
  if (!all.length) return null
  return <span className="pr-steps__squares" aria-hidden="true">
    {all.map((kind, index) => <i key={index} className={`is-${kind}`} title={SQUARE_LABEL[kind]} />)}
    {more > 0 && <em>+{more}</em>}
  </span>
}

/** The purchase's steps with how many positions stand on each. Pressing one shows
 * its positions; pressing it again shows them all. The counts stay whatever is
 * shown, since they describe the purchase and not the list. */
export function CampaignStepsBar({ counts, plan, filter, onFilterChange }) {
  const selected = stepOfFilter(filter)
  const beyond = stepsBeyondReach(plan)
  const press = step => onFilterChange(selected === step ? 'all' : `${STEP_FILTER}${step}`)
  const tone = (step, { count, waiting, again }) => {
    if (!count && step === 'search' && again) return 'is-working'
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
      title={stepTitle(label, step, entry)}
      onClick={() => press(step)}
    >
      <span>{label}</span>
      <span className="pr-steps__count">
        <b>{entry.count}</b>
        <Squares step={step} entry={entry} />
      </span>
    </button>
  }
  const side = SIDE_STEPS.filter(([step]) => counts[step].count > 0 || selected === step)
  return <nav className="pr-steps" aria-label="Этапы закупки">
    <ol>{MEMBER_STEPS.map(entry => <li key={entry[0]}>{button(entry)}</li>)}</ol>
    {side.length > 0 && <ul>{side.map(entry => <li key={entry[0]}>{button(entry)}</li>)}</ul>}
  </nav>
}
