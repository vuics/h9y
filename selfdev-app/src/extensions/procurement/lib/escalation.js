/** What an escalation is about, said in words a buyer reads.
 *
 * The stored title is written by the negotiator as "Ручная оценка: " plus the
 * risk category codes (HUMAN_REVIEW, PRODUCT_IDENTITY…). Those codes are for
 * the pipeline, not for the queue: the customer read "HUMAN_REVIEW" before he
 * could find which substance it was about. The substance leads the row; this
 * is the line under it.
 */

// Kept in step with ESCALATION_CATEGORY_LABELS in h9y-procurement
// (src/analytics/bottlenecks.py).
export const ESCALATION_CATEGORY_LABELS = {
  DANGEROUS_LOGISTICS: 'Опасная логистика',
  PRODUCT_IDENTITY: 'Идентичность продукта',
  DOCUMENT_MISMATCH: 'Несоответствие документов',
  CUSTOM_SYNTHESIS: 'Кастомный синтез',
  SCARCE_POSITION: 'Дефицитная позиция',
  GRADE_SELECTION: 'Выбор грейда',
  HUMAN_REVIEW: 'Нужна проверка специалиста',
  OTHER: 'Прочее',
}

const CODE = /^[A-Z][A-Z0-9_]+$/
const MANUAL_PREFIX = /^\s*Ручная оценка\s*:\s*/i

const categoryLabel = code => ESCALATION_CATEGORY_LABELS[code] || null

const REASON_MAX = 90

function firstSentence(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  const sentence = clean.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '')
  return sentence.length > REASON_MAX ? `${sentence.slice(0, REASON_MAX - 1).trimEnd()}…` : sentence
}

/** The categories, from the risks when present and from the title otherwise. */
function categories(escalation) {
  const fromRisks = (escalation?.risks || []).map(risk => risk?.category).filter(Boolean)
  if (fromRisks.length) return [...new Set(fromRisks)]
  const title = escalation?.title || ''
  if (!MANUAL_PREFIX.test(title)) return []
  return [...new Set(title.replace(MANUAL_PREFIX, '').split(',').map(part => part.trim()).filter(part => CODE.test(part)))]
}

/** The secondary line: the kind of judgement asked for, in Russian. */
export function escalationKind(escalation) {
  const title = (escalation?.title || '').trim()
  const codes = categories(escalation)
  // "Other" names nothing; the risk's own reason, written in Russian by the
  // negotiator, says what is actually being asked.
  if (codes.length && codes.every(code => code === 'OTHER')) {
    const reason = firstSentence((escalation?.risks || []).find(risk => risk?.reason)?.reason)
    if (reason) return reason
  }
  // "Needs a specialist" says nothing once a concrete reason is named.
  const specific = codes.filter(code => code !== 'HUMAN_REVIEW')
  const shown = (specific.length ? specific : codes)
    .map(code => categoryLabel(code) || (CODE.test(code) ? 'Прочее' : code))
  if (shown.length) return [...new Set(shown)].join(', ')
  // A title someone wrote in words is already readable; codes never are.
  if (title && !MANUAL_PREFIX.test(title) && !CODE.test(title)) return title
  return 'Нужна проверка специалиста'
}

/** The headline: which substance. */
export function escalationSubject(escalation) {
  return escalation?.cardTitle || (escalation?.cardId ? `Карточка #${escalation.cardId}` : 'Вещество не указано')
}

const OPEN_STATUSES = new Set(['OPEN', 'IN_REVIEW', 'RECOMMENDED'])

/** Where a card that waits for a specialist should open.
 *
 * The decision lives on the escalation, not on the card: one open case opens
 * directly, several open the queue filtered to the card, none falls back to the
 * card itself.
 */
export function escalationTarget(cardId, escalations = []) {
  const open = escalations.filter(item => OPEN_STATUSES.has(item?.status))
  if (open.length === 1) return `/procurement/escalations/${open[0].id}`
  if (open.length > 1) {
    // The queue filters by one status only; when the open cases share one,
    // use it so the resolved history of the card does not bury them.
    const statuses = new Set(open.map(item => item.status))
    const status = statuses.size === 1 ? `&status=${[...statuses][0]}` : ''
    return `/procurement/escalations?cardId=${cardId}${status}`
  }
  return `/procurement/requests/${cardId}`
}
