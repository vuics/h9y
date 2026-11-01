import React from 'react'

import { memberSteps } from '../lib/memberSteps'

const STATUS_WORD = {
  done: 'готово',
  working: 'агент работает',
  waiting: 'ждёт вас',
  failed: 'сбой',
  todo: 'впереди',
  off: 'не входит в план',
}

/** Where this substance is, what is asked now and what follows the answer. */
export function MemberSteps({ member, plan, offers }) {
  const { steps, now, next } = memberSteps(member, plan, offers)
  return <div className="pr-member-steps">
    <ol className="pr-member-steps__list" aria-label="Этапы по веществу">
      {steps.map(step => <li key={step.id} className={`is-${step.status}`} aria-current={['working', 'waiting'].includes(step.status) ? 'step' : undefined}>
        <strong>{step.label}</strong>
        <span>{STATUS_WORD[step.status]}</span>
      </li>)}
    </ol>
    <p><strong>{now}</strong> {next}</p>
  </div>
}
