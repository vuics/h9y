import React from 'react'
import { Link } from 'react-router-dom'

import { shortDate, threadRibbon } from '../lib/threadRibbon'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Bot, Clock, Form, MailOff, Pencil } from './icons'

const MARK_ICONS = {
  out: ArrowUpRight,
  in: ArrowDownLeft,
  auto: Bot,
  failed: MailOff,
  escalationOpen: AlertTriangle,
  escalationResolved: AlertTriangle,
}

const UPCOMING_ICONS = { draft: Pencil, webForm: Form, planned: Clock }

/** One event: a link to the letter, or, for an open case, the decision in place. */
function Mark({ item, decidable, onDecide }) {
  const Icon = MARK_ICONS[item.type]
  const icon = <Icon size={13} />
  if (item.type === 'escalationOpen' && decidable) {
    return <button
      type="button"
      className="pr-ribbon__mark"
      data-type={item.type}
      title={`${item.title} — решить здесь`}
      aria-label={item.title}
      onClick={() => onDecide(item.event.id)}
    >{icon}</button>
  }
  return <Link className="pr-ribbon__mark" data-type={item.type} to={item.href} title={item.title} aria-label={item.title}>{icon}</Link>
}

/** A conversation's history as a row of marks: who wrote, what broke, how long it has been quiet.
 *
 * `decidable` holds the open escalations this position can decide inline;
 * any other case leads to its own page.
 */
export function ThreadRibbon({ thread, decidable = new Set(), onDecide, now }) {
  const ribbon = threadRibbon(thread, { now })
  if (!ribbon.items.length && !ribbon.upcoming) return null
  const conversation = `/procurement/negotiations/${thread.assignmentId}`
  const { silence, upcoming } = ribbon
  return <span className="pr-ribbon">
    {ribbon.hidden > 0 && <Link
      className="pr-ribbon__more"
      to={conversation}
      title={`Ещё ${ribbon.hidden} раньше — открыть переписку`}
    >+{ribbon.hidden}</Link>}
    {ribbon.items.map(item => (item.kind === 'gap'
      ? <span key={item.key} className="pr-ribbon__gap" title="Пауза">{item.label}</span>
      : <Mark key={item.key} item={item} decidable={decidable.has(item.event.id)} onDecide={onDecide} />))}
    {silence && <span
      className={silence.late ? 'pr-ribbon__silence is-late' : 'pr-ribbon__silence'}
      title={`Наше последнее письмо — ${shortDate(silence.since)}; ответа нет`}
    >{silence.label} без ответа</span>}
    {upcoming && <Link
      className="pr-ribbon__mark"
      data-type="upcoming"
      to={conversation}
      title={upcoming.title}
      aria-label={upcoming.title}
    >{React.createElement(UPCOMING_ICONS[upcoming.type], { size: 13 })}</Link>}
  </span>
}
