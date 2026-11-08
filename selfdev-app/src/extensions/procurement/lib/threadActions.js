/** What a person can do to one conversation from its line under a position.
 *
 * One button for the thing the conversation waits on, and a menu for the rest.
 * Kept out of the component so the rules — which state gets which button, what
 * may be closed, what a reminder is called — are testable without a browser.
 */

/** Statuses a conversation can still be ended from: the server's list. */
export const LIVE_STATUSES = [
  'READY', 'QUEUED', 'ACTIVE', 'WAITING_SUPPLIER', 'FOLLOW_UP_DUE', 'ESCALATED', 'PAUSED_BY_CHANGE',
]

/** Why a specialist ends a conversation, in the order a person reaches for them. */
export const CLOSE_REASONS = [
  { code: 'SUPPLIER_DECLINED', label: 'Поставщик отказал' },
  { code: 'BOUGHT_ELSEWHERE', label: 'Купили у другого поставщика' },
  { code: 'NO_RESPONSE', label: 'Поставщик не отвечает' },
  { code: 'WRONG_PRODUCT', label: 'Предлагают не тот продукт' },
  { code: 'OTHER', label: 'Другое' },
]

export const closeReasonLabel = code =>
  CLOSE_REASONS.find(reason => reason.code === code)?.label || null

export const isLive = thread => LIVE_STATUSES.includes(thread.status)

/** The last letter the supplier wrote, for «Ответить» to land on. */
function lastInbound(thread) {
  const events = thread.events || []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.kind === 'message' && event.direction === 'INBOUND' && !event.automatic) return event
  }
  return null
}

/** The open case on this conversation that the position can decide here. */
export function decidableCase(thread, decidable = new Set()) {
  const events = thread.events || []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.kind === 'escalation' && !event.resolved && decidable.has(event.id)) return event
  }
  return null
}

/** The one thing this conversation waits on a person for, as a button; or nothing.
 *
 * A conversation the agent is running gets no button: nothing is asked of
 * anybody, and a button there would invite meddling with work that is going.
 */
export function primaryAction(thread, { decidable = new Set() } = {}) {
  const conversation = `/procurement/negotiations/${thread.assignmentId}`
  if (!isLive(thread)) return null
  const pending = decidableCase(thread, decidable)
  if (pending) return { kind: 'decide', label: 'Решить', escalationId: pending.id }
  if (thread.automationPaused) return { kind: 'resume', label: 'Возобновить' }
  switch (thread.waitingFor) {
    case 'SEND':
      return { kind: 'send', label: 'Отправить' }
    case 'WEB_FORM':
      return { kind: 'link', label: 'Заполнить форму', to: conversation }
    case 'REPLY': {
      const letter = lastInbound(thread)
      return { kind: 'link', label: 'Ответить', to: letter ? `${conversation}#msg-${letter.id}` : conversation }
    }
    default:
      return null
  }
}

/** The rest, behind «⋮»: what is rarely needed and never urgent. */
export function menuActions(thread) {
  const live = isLive(thread)
  const items = []
  if (live && !thread.automationPaused) items.push({ kind: 'pause', label: 'Остановить агента' })
  if (live && thread.automationPaused) items.push({ kind: 'resume', label: 'Возобновить агента' })
  if (live && !thread.automationPaused && ['WAITING_SUPPLIER', 'FOLLOW_UP_DUE'].includes(thread.status)) {
    items.push({ kind: 'remind', label: 'Напомнить сейчас' })
  }
  if (live && !thread.automationPaused && thread.status === 'QUEUED' && thread.waitingFor !== 'WEB_FORM') {
    items.push({ kind: 'remind', label: 'Отправить сейчас' })
  }
  items.push({ kind: 'link', label: 'Открыть переписку', to: `/procurement/negotiations/${thread.assignmentId}` })
  if (live) items.push({ kind: 'close', label: 'Закрыть переписку…', danger: true })
  return items
}

/** How an ended conversation explains itself on its line. */
export function endedNote(thread) {
  if (thread.status !== 'CANCELLED') return null
  const label = closeReasonLabel(thread.closeReason)
  return {
    text: label ? `закрыта: ${label.toLowerCase()}` : 'закрыта',
    title: thread.endedBecause || undefined,
  }
}

/** What a send from the line came to, in the line's own words. */
export function sendOutcome(result, assignmentId) {
  if (result?.sent?.includes(assignmentId)) return { tone: 'success', text: 'Письмо передано на отправку.' }
  const skipped = result?.skipped?.find(item => item.assignmentId === assignmentId)
  if (skipped?.code === 'RFQ_SUPERSEDED') {
    return { tone: 'warning', text: 'Не отправлено: письмо подготовлено по старому RFQ. Согласуйте RFQ заново.' }
  }
  if (skipped?.code === 'ALREADY_SENT') return { tone: 'success', text: 'Письмо уже ушло.' }
  const error = result?.errors?.find(item => item.assignmentId === assignmentId)
  if (error) return { tone: 'danger', text: `Не отправлено: ${error.message || error.code}` }
  return { tone: 'warning', text: 'Не отправлено: переписка уже не ждёт отправки.' }
}

/** How many of a position's conversations a «закрыть все» would end. */
export const liveCount = threads => threads.filter(isLive).length
