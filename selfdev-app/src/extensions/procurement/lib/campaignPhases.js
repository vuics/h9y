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

/** Each member's phase, sharpened by the offers the page has: a substance
 * with a priced offer is «с ценой» whatever its conversation says, and one
 * answered only on the marketplace is answered all the same. */
export function memberPhases(members, offersByCard = new Map()) {
  const counts = Object.fromEntries(PHASES.map(([key]) => [key, 0]))
  for (const member of members || []) {
    const offers = offersByCard.get(member.cardId)
    const offerCount = Array.isArray(offers?.offers) ? offers.offers.length : offers?.offers || 0
    let phase
    if (member.stage === 'DONE') phase = 'done'
    else if (offers?.priced > 0) phase = 'priced'
    else if (['OUTREACH', 'NEGOTIATION'].includes(member.stage)) {
      phase = member.responseCount > 0 || offerCount > 0 ? 'answered' : 'waiting'
    } else if (member.stage === 'AWAITING_REVIEW') phase = 'review'
    else if (['QUEUED', 'SOURCING', 'CONTACTS'].includes(member.stage)) phase = 'searching'
    else if (member.stage === 'FAILED') phase = 'failed'
    else phase = 'skipped'
    counts[phase] += 1
  }
  return counts
}

export function phaseSummary(counts, limit = 3) {
  return PHASES
    .filter(([key]) => counts?.[key] > 0)
    .slice(0, limit)
    .map(([key, label]) => `${counts[key]} ${label}`)
    .join(' · ')
}

