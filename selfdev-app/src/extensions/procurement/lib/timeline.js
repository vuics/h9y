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

/** Quotation revisions indexed by the message they were extracted from. */
export function quotesByMessage(quotes = []) {
  const index = new Map()
  for (const quote of quotes) {
    if (!quote.communicationId) continue
    const bucket = index.get(quote.communicationId) || []
    bucket.push(quote)
    index.set(quote.communicationId, bucket)
  }
  return index
}

/** The newest unlinked revision of each response, carrying how many there are. */
export function latestUnlinked(quotes = []) {
  const byResponse = new Map()
  for (const quote of quotes) {
    if (quote.communicationId) continue
    const current = byResponse.get(quote.responseId)
    byResponse.set(quote.responseId, {
      quote: !current || quote.revision >= current.quote.revision ? quote : current.quote,
      count: (current?.count || 0) + 1,
    })
  }
  return [...byResponse.values()].map(({ quote, count }) => ({ ...quote, revisionCount: count }))
}

export function buildTimeline({
  messages = [], compositions = [], statusHistory = [], quotes = [],
  escalations = [], cardChange = null,
} = {}) {
  const attribution = attributionByCommunication(compositions)
  const quoted = quotesByMessage(quotes)

  const messageEntries = messages.map(message => ({
    kind: 'message',
    id: message.id,
    at: message.createdAt,
    message,
    attribution: attribution.get(message.id) || null,
    // What the extractor made of this message, shown under it rather than on
    // the proposal page: the numbers and the sentence they came from belong
    // next to each other.
    quotes: quoted.get(message.id) || [],
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

  // A revision whose exact source message could not be identified — a
  // quotation entered by hand, or one recorded before messages were linked —
  // still belongs in the chronology, on its own, rather than being attached to
  // whichever message happens to be nearby. Only the last of them, though: a
  // response with five unlinked revisions would otherwise fill the thread with
  // five full panels nobody can place in the conversation.
  const orphanQuotes = latestUnlinked(quotes).map(quote => ({
    kind: 'quote',
    id: `quote:${quote.responseId}:${quote.revision}`,
    at: quote.receivedAt,
    quote,
  }))

  const escalationEntries = escalations.map(escalation => ({
    kind: 'escalation',
    id: escalation.id,
    at: escalation.createdAt || escalation.updatedAt,
    escalation,
  }))

  // The requirement moving is an event in the conversation, not a property of
  // it: it happened at a moment, between two messages, and it is read there.
  const changeEntries = cardChange ? [{
    kind: 'cardChange',
    id: `card-change:${cardChange.detectedAt}`,
    at: cardChange.detectedAt,
    cardChange,
  }] : []

  return [
    ...messageEntries, ...compositionEntries, ...statusEntries,
    ...escalationEntries, ...changeEntries, ...orphanQuotes,
  ].sort((left, right) => timeOf(left.at) - timeOf(right.at))
}

/** A composition that has not reached the supplier yet, whatever its status. */
export function isUnsent(record) {
  return !record?.communicationId
    && ['DRAFT', 'BLOCKED', 'APPROVED'].includes(record?.status)
}

/** The dispatch the worker still owes this conversation, if any.
 *
 * Synthesised rather than stored: the assignment holds the next action and its
 * time, and the thread is where "what happens next, when, and through which
 * channel" has to be answerable without reading a status field.
 */
export function plannedAction(negotiation) {
  if (!negotiation?.nextActionAt) return null
  if (!['QUEUED', 'FOLLOW_UP_DUE', 'READY'].includes(negotiation.status)) return null
  return {
    kind: 'planned',
    id: `planned:${negotiation.id}`,
    at: negotiation.nextActionAt,
    action: negotiation.nextAction,
    channel: negotiation.channel,
    negotiation,
  }
}

/** Split one chronology into what happened and what is still going to happen.
 *
 * Drafts sort by the moment they were written, which puts a message that has
 * not been sent yet in the middle of the history of ones that were. Everything
 * still ahead of the supplier belongs after the "now" line instead.
 */
export function splitFuture(timeline = [], negotiation = null) {
  const past = []
  const future = []
  for (const entry of timeline) {
    if (entry.kind === 'composition' && isUnsent(entry.composition)) future.push(entry)
    else past.push(entry)
  }
  const planned = plannedAction(negotiation)
  if (planned) future.push(planned)
  future.sort((left, right) => timeOf(left.at) - timeOf(right.at))
  return { past, future }
}

/** Fold runs of consecutive status changes into one collapsible entry.
 *
 * A single dispatch writes three of them — QUEUED, WAITING_SUPPLIER, QUEUED
 * again, all in the same second — so on a real conversation the machine's own
 * bookkeeping outnumbers the messages and buries them.
 */
export function collapseStatusRuns(entries = [], { min = 2 } = {}) {
  const folded = []
  let run = []
  const flush = () => {
    if (run.length >= min) {
      folded.push({
        kind: 'statusGroup',
        id: `status-group:${run[0].id}`,
        at: run[0].at,
        events: run.map(item => item.event),
      })
    } else {
      folded.push(...run)
    }
    run = []
  }
  for (const entry of entries) {
    if (entry.kind === 'status') run.push(entry)
    else { flush(); folded.push(entry) }
  }
  flush()
  return folded
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
