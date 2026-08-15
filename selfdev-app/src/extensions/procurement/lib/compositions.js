/** Decisions about a generated supplier message, as pure functions.
 *
 * Kept out of the page for the same reason `escalations.js` is: these rules
 * mirror the backend's state machine, and a rule the tests can reach is a rule
 * that cannot quietly drift away from it.
 */

/** Statuses where a human still owes a decision. */
export const PENDING_STATUSES = ['DRAFT', 'BLOCKED']

export function isPending(status) {
  return PENDING_STATUSES.includes(status)
}

/** What the current user may do with this message.
 *
 * A blocked message stays editable: fixing the text is exactly how a specialist
 * clears a failed check, and the backend re-runs every check on the edit.
 */
export function compositionActions(status, { canQueue = false } = {}) {
  const pending = isPending(status)
  return {
    canEdit: pending && canQueue,
    canApprove: pending && canQueue,
    canReject: pending && canQueue,
  }
}

/** Counts per check outcome, plus the failures that held the message back. */
export function checkSummary(checks = []) {
  const failed = checks.filter(check => check.status === 'FAILED')
  return {
    passed: checks.filter(check => check.status === 'PASSED').length,
    failed: failed.length,
    skipped: checks.filter(check => check.status === 'SKIPPED').length,
    blocking: failed,
  }
}

/** What would actually be sent: the human edit when there is one. */
export function finalText(record) {
  if (!record) return ''
  return record.editedText ?? record.draftText ?? ''
}

/** Only send `editedText` when the text really changed.
 *
 * Posting the unchanged draft back would record a human edit that never
 * happened, and the edit signal is what later tells us which rules are missing
 * from the library.
 */
export function approvalPayload(record, text, note) {
  const payload = {}
  if (text !== finalText(record)) payload.editedText = text
  if (note) payload.note = note
  return payload
}
