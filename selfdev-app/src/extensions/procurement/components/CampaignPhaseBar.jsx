import React from 'react'

import { PHASES } from '../lib/campaignPhases'

export { PHASES, memberPhases, phaseSummary } from '../lib/campaignPhases'

export function CampaignPhaseBar({ counts, total, legend = false, className = '' }) {
  const present = PHASES.filter(([key]) => counts?.[key] > 0)
  const all = total || present.reduce((sum, [key]) => sum + counts[key], 0)
  const title = present.map(([key, label]) => `${label}: ${counts[key]}`).join(', ')
  return <div className={`pr-phase ${className}`}>
    <div className="pr-phase__track" role="img" aria-label={title || 'нет веществ'} title={title}>
      {all > 0 && present.map(([key, label, tone]) => <span
        key={key}
        className={`is-${tone}`}
        style={{ width: `${(counts[key] / all) * 100}%` }}
        title={`${label}: ${counts[key]}`}
      />)}
    </div>
    {legend && present.length > 0 && <ul className="pr-phase__legend">
      {present.map(([key, label, tone]) => <li key={key}>
        <i className={`is-${tone}`} aria-hidden="true" />{label}<b>{counts[key]}</b>
      </li>)}
    </ul>}
  </div>
}
