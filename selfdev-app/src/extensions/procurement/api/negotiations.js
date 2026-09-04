// Mirrors the server rule rather than restating it: queue_assignment refuses
// only these four. An allowlist here drifted from it and silently blocked
// ACTIVE — the status an assignment takes as soon as any supplier message is
// recorded, including a quotation entered by hand before the first email went
// out. Those conversations could not be started from the UI at all.
export const unqueueableNegotiationStatuses = new Set([
  'CANCELLED', 'COMPLETE', 'ESCALATED', 'STALE',
  // Paused by a card change: the domain refuses a queue until a person has
  // decided whether this conversation continues on the new requirement.
  'PAUSED_BY_CHANGE',
])

export function isQueueableNegotiationStatus(status) {
  return Boolean(status) && !unqueueableNegotiationStatuses.has(status)
}
export const followUpNegotiationStatuses = new Set(['WAITING_SUPPLIER', 'FOLLOW_UP_DUE'])

export function isUsableNegotiationContact(contact) {
  return Boolean(contact?.active) && contact.verificationStatus !== 'INVALID' &&
    (contact.channel !== 'xmpp' || contact.verificationStatus === 'VERIFIED')
}

/** Where the conversation may still be moved to another contact.
 *
 * Mirrors `set_assignment_contact`: a finished, cancelled or stale assignment
 * keeps the channel it ran on, because nothing more will be sent on it.
 */
export const channelChangeableNegotiationStatuses = new Set([
  'READY', 'QUEUED', 'ACTIVE', 'WAITING_SUPPLIER', 'FOLLOW_UP_DUE', 'ESCALATED', 'PAUSED_BY_CHANGE',
])

export function negotiationNextActionLabel(nextAction) {
  if (nextAction === 'FOLLOW_UP') return 'Уточняющий запрос'
  if (nextAction === 'SEND_INITIAL_RFQ') return 'Отправка согласованного RFQ'
  return 'Не назначено'
}

export function toApiDateTime(localValue) {
  return localValue ? new Date(localValue).toISOString() : null
}
