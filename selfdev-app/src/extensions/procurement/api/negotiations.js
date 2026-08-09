export const queueableNegotiationStatuses = new Set(['READY', 'QUEUED', 'WAITING_SUPPLIER', 'FOLLOW_UP_DUE'])
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
