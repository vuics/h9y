/** Merge everything that happened in one supplier conversation into one ribbon.
 *
 * The backend keeps these in three places for good reasons — messages are
 * append-only channel history, compositions are the agent's reasoning record,
 * status changes belong to the assignment — but a specialist asking "what
 * happened with this supplier" needs them in one column, in order.
 *
 * Merging happens here rather than server-side so neither collection has to know
 * about the other, and so the rules are directly testable.
 */

const AT_THE_END = 8.64e15

function timeOf(value) {
  const parsed = Date.parse(value ?? '')
  // An entry with no usable timestamp sorts last rather than to 1970, where it
  // would claim to be the oldest thing that ever happened.
  return Number.isNaN(parsed) ? AT_THE_END : parsed
}

/** A composition that was actually delivered is already in the message list.
 *
 * Showing both would double every sent message, so a delivered composition
 * contributes its attribution to the message instead of its own entry.
 */
export function attributionByCommunication(compositions = []) {
  const index = new Map()
  for (const record of compositions) {
    if (record.communicationId) index.set(record.communicationId, record)
  }
  return index
}

export function buildTimeline({ messages = [], compositions = [], statusHistory = [] } = {}) {
  const attribution = attributionByCommunication(compositions)

  const messageEntries = messages.map(message => ({
    kind: 'message',
    id: message.id,
    at: message.createdAt,
    message,
    attribution: attribution.get(message.id) || null,
  }))

  // Only the compositions that never became a message: held, blocked, refused,
  // or approved and still waiting for the worker.
  const compositionEntries = compositions
    .filter(record => !record.communicationId)
    .map(record => ({
      kind: 'composition',
      id: record.compositionId,
      at: record.createdAt,
      composition: record,
    }))

  const statusEntries = statusHistory.map((event, index) => ({
    kind: 'status',
    id: `${event.changedAt}-${event.toStatus}-${index}`,
    at: event.changedAt,
    event,
  }))

  return [...messageEntries, ...compositionEntries, ...statusEntries]
    .sort((left, right) => timeOf(left.at) - timeOf(right.at))
}

/** Entries a human still owes a decision on, oldest first. */
export function pendingDecisions(timeline = []) {
  return timeline.filter(entry =>
    entry.kind === 'composition' && ['DRAFT', 'BLOCKED'].includes(entry.composition.status))
}

/** One-line summary of the conversation's live state, for the list view. */
export function conversationPulse({ negotiation, timeline = [] } = {}) {
  const pending = pendingDecisions(timeline).length
  if (pending) return { tone: 'warning', text: `Ждёт решения: ${pending}` }
  if (negotiation?.lastWorkerError) return { tone: 'danger', text: 'Ошибка обработки' }
  if (negotiation?.status === 'ESCALATED') return { tone: 'danger', text: 'Передано специалисту' }
  if (negotiation?.status === 'WAITING_SUPPLIER') return { tone: 'waiting', text: 'Ждём поставщика' }
  return { tone: 'progress', text: 'В работе' }
}
