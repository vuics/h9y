/** Turn a specialist's edit of a draft into a candidate library rule.
 *
 * When someone rewrites what the agent wrote, they are applying knowledge the
 * library does not hold yet. That is the cheapest door into the company memory
 * the customer described: one edit at a time, with a human confirming each rule
 * rather than the system inferring one silently.
 *
 * Everything here only *proposes*. Nothing is saved until the specialist opens
 * the pre-filled form and saves it themselves.
 */

const SENTENCE = /[^.!?\n]+[.!?]*/g

function sentences(text) {
  return String(text || '').match(SENTENCE)?.map(part => part.trim()).filter(Boolean) || []
}

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim()

/** Sentences present in the edit that were not in the draft, and vice versa. */
export function sentenceDiff(draftText, editedText) {
  const before = sentences(draftText).map(normalize)
  const after = sentences(editedText).map(normalize)
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return {
    added: after.filter(line => !beforeSet.has(line)),
    removed: before.filter(line => !afterSet.has(line)),
  }
}

/** Was this a real change, or whitespace?
 *
 * A reflow is not knowledge, and offering to make a rule out of one would train
 * the specialist to ignore the prompt.
 */
export function isMeaningfulEdit(record) {
  if (!record?.editedText) return false
  if (normalize(record.draftText) === normalize(record.editedText)) return false
  const { added, removed } = sentenceDiff(record.draftText, record.editedText)
  return added.length > 0 || removed.length > 0
}

/** A directive draft the specialist can accept, reword or discard.
 *
 * Scoped to the same supplier the edit happened on rather than to everything:
 * a correction made in one conversation is evidence about that conversation,
 * and widening it to the whole installation is the specialist's call, not ours.
 */
export function suggestRule(record) {
  if (!isMeaningfulEdit(record)) return null
  const { added, removed } = sentenceDiff(record.draftText, record.editedText)
  const lines = []
  if (added.length) lines.push(`Пиши так: ${added.join(' ')}`)
  if (removed.length) lines.push(`Не пиши так: ${removed.join(' ')}`)
  return {
    kind: 'DIRECTIVE',
    title: `Правка из ${record.compositionId}`.slice(0, 120),
    body: lines.join('\n').slice(0, 4000),
    language: 'any',
    provenance: 'LEARNED_FROM_EDIT',
    sourceCompositionId: record.compositionId,
    scope: {
      cardIds: [],
      supplierIds: record.supplierId ? [record.supplierId] : [],
      countries: [],
      channels: [],
      stages: record.stage ? [record.stage] : [],
    },
    added,
    removed,
  }
}
