// Mirrors the server rule rather than restating it: queue_assignment refuses
// only these four. An allowlist here drifted from it and silently blocked
// ACTIVE — the status an assignment takes as soon as any supplier message is
// recorded, including a quotation entered by hand before the first email went
// out. Those conversations could not be started from the UI at all.
export const unqueueableNegotiationStatuses = new Set(['CANCELLED', 'COMPLETE', 'ESCALATED', 'STALE'])

export function isQueueableNegotiationStatus(status) {
  return Boolean(status) && !unqueueableNegotiationStatuses.has(status)
}
export const followUpNegotiationStatuses = new Set(['WAITING_SUPPLIER', 'FOLLOW_UP_DUE'])

export function isUsableNegotiationContact(contact) {
  return Boolean(contact?.active) && contact.verificationStatus !== 'INVALID' &&
    (contact.channel !== 'xmpp' || contact.verificationStatus === 'VERIFIED')
}

export function negotiationNextActionLabel(nextAction) {
  if (nextAction === 'FOLLOW_UP') return 'Уточняющий запрос'
  if (nextAction === 'SEND_INITIAL_RFQ') return 'Отправка согласованного RFQ'
  return 'Не назначено'
}

export function toApiDateTime(localValue) {
  return localValue ? new Date(localValue).toISOString() : null
}
