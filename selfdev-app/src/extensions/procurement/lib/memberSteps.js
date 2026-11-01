/** The purchase's way from the search to a price, as a row of steps above its
 * positions.
 *
 * Each position stands on exactly one step, the furthest it has reached, so the
 * counts add up to the list and pressing a step filters it. A repeated search does
 * not send a position with answers back: a count that jumped backwards would read
 * as lost work, and the row's own bar shows the search.
 */
export const MEMBER_STEPS = [
  ['search', 'Поиск'],
  ['companies', 'Кому писать'],
  ['rfq', 'Текст запроса'],
  ['send', 'Рассылка'],
  ['replies', 'Ответы'],
  ['result', 'Цены'],
]

/** Off the way: a position here is not further along or behind any step. */
export const SIDE_STEPS = [
  ['failed', 'Сбой'],
  ['skipped', 'Исключены'],
]

const ALL_STEPS = [...MEMBER_STEPS, ...SIDE_STEPS]

export const STEP_FILTER = 'step:'

export const stepOfFilter = filter =>
  typeof filter === 'string' && filter.startsWith(STEP_FILTER) ? filter.slice(STEP_FILTER.length) : null

export const stepLabel = step => ALL_STEPS.find(([id]) => id === step)?.[1] || step

const present = value => value != null && String(value).trim() !== ''

const hasPrice = (member, offers) =>
  (offers?.priced || 0) > 0
  || (member.webPriceCount || 0) > 0
  // A price without a unit cannot be compared, but a buyer has it all the same.
  || (Array.isArray(offers?.offers) && offers.offers.some(offer => present(offer.price)))

const REACH_END = { SOURCING: 'search', CONTACTS: 'companies' }

function waitingStep(member) {
  switch (member.waitingFor) {
    case 'SUPPLIER_EVIDENCE': return 'search'
    case 'CANDIDATE_REVIEW':
    case 'SUPPLIER_CONTACT': return 'companies'
    case 'RFQ_APPROVAL': return 'rfq'
    case 'MESSAGE_APPROVAL': return 'send'
    default: break
  }
  if (member.stage === 'AWAITING_REVIEW') return member.rfqAwaitingApproval ? 'rfq' : 'companies'
  return null
}

/** The one step a position stands on. `offers` is the page's tally for it. */
export function memberStep(member, offers = {}, plan = {}) {
  if (member.errorCode || member.stage === 'FAILED') return 'failed'
  if (['SKIPPED', 'REMOVED', 'CANCELLED'].includes(member.stage)) return 'skipped'
  if (hasPrice(member, offers)) return 'result'
  const offerCount = Array.isArray(offers?.offers) ? offers.offers.length : offers?.offers || 0
  if (member.responseCount > 0 || offerCount > 0) return 'replies'
  const waiting = waitingStep(member)
  if (waiting) return waiting
  switch (member.stage) {
    case 'OUTREACH': return 'send'
    case 'NEGOTIATION': return member.requestCount ? 'replies' : 'send'
    case 'DONE':
      if (member.requestCount) return 'replies'
      return REACH_END[plan?.reach] || 'rfq'
    default: return 'search'
  }
}

/** Whether a person is what the position is waiting for on its step. */
export const memberWaitsOnStep = member =>
  !member.errorCode && member.stage !== 'FAILED' && Boolean(waitingStep(member))

/** Each step's count, how many of them wait for a person, and whether the purchase
 * was set up to reach it. */
export function memberStepCounts(members = [], offersByCard = new Map(), plan = {}) {
  const counts = Object.fromEntries(ALL_STEPS.map(([id]) => [id, { count: 0, waiting: 0 }]))
  for (const member of members) {
    const step = memberStep(member, offersByCard.get(member.cardId), plan)
    counts[step].count += 1
    if (step !== 'result' && step !== 'replies' && memberWaitsOnStep(member)) counts[step].waiting += 1
  }
  return counts
}

export function stepsBeyondReach(plan = {}) {
  const end = REACH_END[plan?.reach]
  if (!end) return new Set()
  const at = MEMBER_STEPS.findIndex(([id]) => id === end)
  return new Set(MEMBER_STEPS.slice(at + 1).map(([id]) => id))
}

/** What a site publishes across a position's candidates, cheapest per millilitre
 * or gram first; a price with no pack to divide by comes after those. */
export function webOfferRows(run) {
  const rows = (run?.candidates || []).flatMap(candidate =>
    (candidate.webOffers || []).map(offer => ({ ...offer, seller: candidate.name, candidateId: candidate.id })))
  const rank = value => (value == null ? Number.POSITIVE_INFINITY : value)
  return rows.sort((left, right) =>
    rank(left.unitPrice) - rank(right.unitPrice) || rank(left.amount) - rank(right.amount))
}
