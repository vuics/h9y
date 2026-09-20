/** The campaign's substance table: one row's state, numbers and next press.
 *
 * The page opens on this table, so a row has to answer three questions without
 * being read twice: where the substance stands, what came in, and what this
 * person is expected to do about it.
 */

/** Which filter chip a substance belongs to. */
export function memberGroup(member) {
  if (member.errorCode || member.stage === 'FAILED') return 'failed'
  if (member.marketplaceStatus === 'NEEDS_REVIEW') return 'waiting'
  if (member.waitingFor || member.stage === 'AWAITING_REVIEW') return 'waiting'
  if (member.stage === 'DONE' || member.stage === 'SKIPPED') return 'done'
  return 'working'
}

export const FILTERS = [
  ['all', 'Все'],
  ['waiting', 'Ждут вас'],
  ['working', 'В работе'],
  ['done', 'Готово'],
  ['failed', 'Сбои'],
]

export function filterCounts(members) {
  const counts = { all: members.length, waiting: 0, working: 0, done: 0, failed: 0 }
  for (const member of members) counts[memberGroup(member)] += 1
  return counts
}

export const filterMembers = (members, filter) =>
  filter === 'all' ? members : members.filter(member => memberGroup(member) === filter)

/** The presses this row is waiting for: the substance's own decision first,
 * then the marketplace check, quietly — it is the same batch job on every
 * substance of the campaign, and as the only button it hid the rows that
 * really were waiting for a decision.
 */
export function nextActions(member, campaignId) {
  const actions = []
  // A substance can be two things at once: a card that failed and a request
  // the platform never confirmed. Both are offered, in that order.
  const own = ownAction(member, campaignId)
  if (own) actions.push(own)
  if (member.marketplaceStatus === 'NEEDS_REVIEW') {
    actions.push({ label: 'Закончить заявку', to: `/procurement/requests/${member.cardId}/echemi`, tone: 'muted' })
  }
  return actions
}

function ownAction(member, campaignId) {
  if (member.errorCode) {
    return { label: 'Открыть карточку', to: `/procurement/requests/${member.cardId}`, tone: 'danger' }
  }
  switch (member.waitingFor) {
    case 'CANDIDATE_REVIEW':
      return { label: 'Согласовать', to: `/procurement/campaigns/${campaignId}/review`, tone: 'warning' }
    case 'RFQ_APPROVAL':
      return { label: 'Согласовать RFQ', to: `/procurement/requests/${member.cardId}/rfq`, tone: 'warning' }
    case 'MESSAGE_APPROVAL':
      return { label: 'Отправить письма', to: `/procurement/negotiations?cardId=${member.cardId}`, tone: 'warning' }
    default:
      break
  }
  if (member.stage === 'AWAITING_REVIEW') {
    return { label: 'Согласовать', to: `/procurement/campaigns/${campaignId}/review`, tone: 'warning' }
  }
  return null
}

/** Whether the platform is holding this substance and needs a person. */
export const needsMarketplaceAction = member =>
  ['NEEDS_REVIEW', 'HUMAN_ACTION_REQUIRED', 'FAILED', 'STALE'].includes(member.marketplaceStatus)

/** "9 · 7 · 1": candidates found, of them with contacts, verified suppliers. */
export function foundSummary(member) {
  if (!member.candidateCount) return '—'
  return [member.candidateCount, member.contactCount || 0, member.verifiedCount || 0].join(' · ')
}

/** "6 → 2": requests that went out, answers that came back. */
export function requestsSummary(member) {
  if (!member.requestCount) return '—'
  return member.responseCount ? `${member.requestCount} → ${member.responseCount}` : String(member.requestCount)
}

/** Offers in hand across the campaign, counted from the offers themselves.
 *
 * Not from the members' `responseCount`: that counts answers to letters with
 * an addressee, so a substance answered through the marketplace — where the
 * request has no addressee at all — reads as "0 ответов" with prices already
 * on the page.
 */
export function offerTotals(offersByCard) {
  let offers = 0
  let priced = 0
  for (const group of offersByCard.values()) {
    offers += group.offers.length
    priced += group.priced
  }
  return { offers, priced }
}
