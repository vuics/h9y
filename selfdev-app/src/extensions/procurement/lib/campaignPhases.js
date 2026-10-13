/** Where a purchase's substances stand, one coloured segment per phase.
 *
 * It replaced «N из M пройдено», which counted only substances the machine
 * had finished with: a campaign whose every substance was in negotiation, with
 * replies arriving daily, read «0 из 28» — a run moving forward that looked as
 * if it had gone back. Most advanced first, so the bar fills from the left.
 */
export const PHASES = [
  ['done', 'завершено', 'done'],
  ['priced', 'с ценой', 'priced'],
  ['answered', 'с ответами', 'answered'],
  ['waiting', 'ждут ответа', 'waiting'],
  ['review', 'ждут согласования', 'review'],
  ['searching', 'в поиске', 'searching'],
  ['failed', 'с ошибкой', 'failed'],
  ['skipped', 'исключены', 'skipped'],
]

/** A member's phase, sharpened by the offers the page has: a substance with a
 * priced offer is «с ценой» whatever its conversation says, and one answered
 * only on the marketplace is answered all the same. The server counts the
 * list's rows by the same rule. */
export function memberPhase(member, offersByCard = new Map()) {
  const offers = offersByCard.get(member.cardId)
  const offerCount = Array.isArray(offers?.offers) ? offers.offers.length : offers?.offers || 0
  if (member.stage === 'DONE') return 'done'
  if (offers?.priced > 0) return 'priced'
  if (['OUTREACH', 'NEGOTIATION'].includes(member.stage)) {
    return member.responseCount > 0 || offerCount > 0 ? 'answered' : 'waiting'
  }
  if (member.stage === 'AWAITING_REVIEW') return 'review'
  if (['QUEUED', 'SOURCING', 'CONTACTS'].includes(member.stage)) return 'searching'
  if (member.stage === 'FAILED') return 'failed'
  return 'skipped'
}

export function memberPhases(members, offersByCard = new Map()) {
  const counts = Object.fromEntries(PHASES.map(([key]) => [key, 0]))
  for (const member of members || []) counts[memberPhase(member, offersByCard)] += 1
  return counts
}

/** The members table filtered by a legend entry is `phase:<key>`, beside the
 * table's own filters. */
export const PHASE_FILTER = 'phase:'

export const phaseOfFilter = filter =>
  typeof filter === 'string' && filter.startsWith(PHASE_FILTER) ? filter.slice(PHASE_FILTER.length) : null

export const phaseLabel = key => PHASES.find(([id]) => id === key)?.[1] || key

export function phaseSummary(counts, limit = 3) {
  return PHASES
    .filter(([key]) => counts?.[key] > 0)
    .slice(0, limit)
    .map(([key, label]) => `${counts[key]} ${label}`)
    .join(' · ')
}

