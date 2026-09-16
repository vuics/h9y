import React from 'react'

/** How far one substance has got on the step it is actually on.
 *
 * A bar is drawn only where the service counts its own work — the source pass
 * and the contact pass do, and `stepProgress` is absent for every other step.
 * That absence is the point: waiting for a decision, a dispatch or a reply has
 * no denominator to divide by, so a bar there would either sit at zero through
 * a stage that is going fine or need a number invented for it. The stage name
 * on its own is the honest answer, and it is the answer the row already had.
 *
 * Motion is reserved for the one case where the machine is working. A step
 * waiting for a specialist stays still: animating the handover would put the
 * urgency on the wrong side of it, and an operator who sees everything move
 * learns to read nothing.
 */

const WORKING_STAGES = new Set(['SOURCING', 'CONTACTS', 'OUTREACH', 'NEGOTIATION'])

export function CampaignMemberProgress({ stage, stepProgress, waitingFor, errorCode, paused }) {
  const failed = stage === 'FAILED' || Boolean(errorCode)
  // A campaign on hold is working on nothing, whatever its members still say:
  // the driver checks for the hold before it picks the next substance up.
  const working = WORKING_STAGES.has(stage) && !paused && !failed
  const waiting = !working && !failed && Boolean(waitingFor)
  if (!stepProgress) return null

  const { label, done, total, percent } = stepProgress
  const tone = failed ? 'is-failed' : working ? 'is-working' : waiting ? 'is-waiting' : 'is-idle'

  return <div className={`pr-member-progress ${tone}`}>
    <div
      className="pr-member-progress__track"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: обработано ${done} из ${total}`}
    >
      <span className="pr-member-progress__fill" style={{ width: `${percent}%` }} />
    </div>
    <span className="pr-member-progress__figure">
      {percent}%
      {/* The counts, because a percentage alone cannot say whether the pass is
          small and nearly done or large and barely started. */}
      <i>{done}/{total}</i>
    </span>
  </div>
}
