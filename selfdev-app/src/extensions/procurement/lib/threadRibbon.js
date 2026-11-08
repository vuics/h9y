/** The row of marks beside a supplier in a position's «Переписки».
 *
 * A status alone says "ждём поставщика" for a company written to an hour ago
 * and for one silent for two weeks. The marks say who wrote last, what broke on
 * the way, where a person had to decide, and how long the silence has lasted,
 * without opening the conversation. Kept here, out of the component, so the
 * rules — which mark, where a pause is worth a label, when silence turns red —
 * are testable without a browser.
 */

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/** How many marks a line shows; older ones fold into «+N». */
export const RIBBON_VISIBLE = 7

/** Days of silence after which waiting is a problem, not a state. */
export const SILENCE_LATE_DAYS = 7

/** Where a conversation is over or waits for us, silence is not the supplier's. */
const NOT_WAITING_ON_SUPPLIER = ['COMPLETE', 'CANCELLED', 'STALE', 'ESCALATED', 'PAUSED_BY_CHANGE', 'READY']

/** The statuses a planned dispatch is still ahead in, as on the thread's page. */
const PLANNED_IN = ['QUEUED', 'FOLLOW_UP_DUE', 'READY']

const NEXT_ACTION_LABELS = {
  SEND_INITIAL_RFQ: 'Отправка запроса',
  FOLLOW_UP: 'Напоминание поставщику',
}

const timeOf = value => {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isFinite(time) ? time : null
}

const pad = number => String(number).padStart(2, '0')

/** «12.10, 09:30» in the reader's own time. */
export function shortDate(value) {
  const time = timeOf(value)
  if (time === null) return ''
  const date = new Date(time)
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** «3 ч», «4 дн»: how long, as briefly as a line allows. */
export function spanLabel(milliseconds) {
  if (milliseconds < HOUR) return '<1 ч'
  if (milliseconds < DAY) return `${Math.floor(milliseconds / HOUR)} ч`
  return `${Math.floor(milliseconds / DAY)} дн`
}

/** Which mark an event is drawn as. */
export function markType(event) {
  if (event.kind === 'escalation') return event.resolved ? 'escalationResolved' : 'escalationOpen'
  if (event.direction === 'OUTBOUND') return event.failed ? 'failed' : 'out'
  return event.automatic ? 'auto' : 'in'
}

const MARK_TITLES = {
  out: 'Мы написали',
  in: 'Ответ поставщика',
  auto: 'Автоответ — не ответ по существу',
  failed: 'Не доставлено',
  escalationOpen: 'Эскалация ждёт решения',
  escalationResolved: 'Эскалация решена',
}

/** What the tooltip says: when, what, and the first line of it. */
export function markTitle(event) {
  const type = markType(event)
  const detail = event.kind === 'escalation' ? event.title : event.preview
  return [shortDate(event.at), MARK_TITLES[type], detail].filter(Boolean).join(' · ')
}

/** Where a mark leads: the letter itself on the conversation's page, or the case. */
export function markHref(event, assignmentId) {
  if (event.kind === 'escalation') return `/procurement/escalations/${event.id}`
  return `/procurement/negotiations/${assignmentId}#msg-${event.id}`
}

/** What happens next on this conversation, when something does. */
export function upcomingMark(thread) {
  if (thread.waitingFor === 'SEND') {
    return { type: 'draft', title: 'Письмо подготовлено и ждёт отправки' }
  }
  if (thread.waitingFor === 'WEB_FORM') {
    return { type: 'webForm', title: 'Веб-форму на сайте нужно заполнить в браузере' }
  }
  if (thread.nextActionAt && PLANNED_IN.includes(thread.status) && !thread.automationPaused) {
    const label = NEXT_ACTION_LABELS[thread.nextAction] || 'Плановое действие'
    return { type: 'planned', at: thread.nextActionAt, title: `${label} · ${shortDate(thread.nextActionAt)}` }
  }
  return null
}

/** How long the supplier has left our last letter unanswered, if they have.
 *
 * An autoreply does not end the wait, and an undelivered letter does not start
 * one: nobody can answer what never arrived.
 */
export function silence(thread, now = Date.now()) {
  if (thread.awaitingPerson || NOT_WAITING_ON_SUPPLIER.includes(thread.status)) return null
  const messages = (thread.events || []).filter(event => event.kind === 'message' && !event.automatic)
  const last = messages[messages.length - 1]
  if (!last || last.direction !== 'OUTBOUND' || last.failed) return null
  const since = timeOf(last.at)
  if (since === null) return null
  const elapsed = Math.max(0, now - since)
  const days = Math.floor(elapsed / DAY)
  return { since: last.at, days, label: spanLabel(elapsed), late: days >= SILENCE_LATE_DAYS }
}

/** Everything a line draws, in order: folded count, marks with pauses, the wait, what is next. */
export function threadRibbon(thread, { now = Date.now(), visible = RIBBON_VISIBLE } = {}) {
  const events = thread.events || []
  const shown = events.slice(-visible)
  const total = Math.max(thread.eventTotal || 0, events.length)
  const items = []
  let previous = null
  for (const event of shown) {
    const time = timeOf(event.at)
    // A pause gets a label only when it is a day or more: minutes between a
    // letter and an autoreply are not information.
    if (previous !== null && time !== null && time - previous >= DAY) {
      items.push({ kind: 'gap', key: `gap-${event.id}`, label: spanLabel(time - previous) })
    }
    items.push({
      kind: 'mark',
      key: `${event.kind}-${event.id}`,
      type: markType(event),
      event,
      title: markTitle(event),
      href: markHref(event, thread.assignmentId),
    })
    if (time !== null) previous = time
  }
  return {
    hidden: total - shown.length,
    items,
    silence: silence(thread, now),
    upcoming: upcomingMark(thread),
  }
}

/** The supplier silent longest across a position's conversations, for its header. */
export function longestSilence(threads = [], now = Date.now()) {
  let longest = null
  for (const thread of threads) {
    const wait = silence(thread, now)
    if (wait && wait.days >= 1 && (!longest || wait.days > longest.days)) {
      longest = { ...wait, supplierName: thread.supplierName || thread.assignmentId }
    }
  }
  return longest
}
