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

/** The one press this row is waiting for, or nothing while the agent works.
 *
 * Deliberately one: a row with three links is a row nobody reads. Everything
 * else about the substance is behind the row's own expander.
 */
export function nextAction(member, campaignId) {
  if (member.marketplaceStatus === 'NEEDS_REVIEW') {
    return { label: 'Закончить заявку', to: `/procurement/requests/${member.cardId}/echemi`, tone: 'warning' }
  }
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
