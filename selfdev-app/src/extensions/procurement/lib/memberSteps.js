/** One substance's way from the search to a price, as a row of steps.
 *
 * The table says where a substance stands in the machine's words. This says it
 * in the buyer's: what is finished, what is asked of them now, and what the
 * agent does once they have answered. Read only from what the page already has,
 * so it cannot disagree with the rest of the row.
 */
export const MEMBER_STEPS = [
  ['search', 'Поиск поставщиков'],
  ['companies', 'Кому писать'],
  ['rfq', 'Текст запроса'],
  ['send', 'Рассылка'],
  ['replies', 'Ответы'],
  ['result', 'Цены'],
]

const SEARCH = 0
const COMPANIES = 1
const RFQ = 2
const SEND = 3
const REPLIES = 4
const RESULT = 5

/** The step a substance is on, and whether the agent or the buyer holds it. */
function position(member) {
  if (member.errorCode || member.stage === 'FAILED') {
    const at = member.requestCount ? SEND : member.candidateCount ? COMPANIES : SEARCH
    return { at, status: 'failed' }
  }
  switch (member.waitingFor) {
    case 'SUPPLIER_EVIDENCE': return { at: SEARCH, status: 'waiting' }
    case 'CANDIDATE_REVIEW':
    case 'SUPPLIER_CONTACT': return { at: COMPANIES, status: 'waiting' }
    case 'RFQ_APPROVAL': return { at: RFQ, status: 'waiting' }
    case 'MESSAGE_APPROVAL': return { at: SEND, status: 'waiting' }
    default: break
  }
  switch (member.stage) {
    case 'AWAITING_REVIEW':
      return { at: member.rfqAwaitingApproval ? RFQ : COMPANIES, status: 'waiting' }
    case 'OUTREACH': return { at: SEND, status: 'working' }
    case 'NEGOTIATION': return { at: member.requestCount ? REPLIES : SEND, status: 'working' }
    case 'DONE': return { at: REPLIES, status: 'working' }
    default: return { at: SEARCH, status: 'working' }
  }
}

function sentence(member, plan, { at, status }, { answered, priced, stopped }) {
  if (status === 'failed') return { now: 'На этом шаге произошёл сбой.', next: 'Откройте карточку позиции: там причина и повтор.' }
  if (priced) return { now: 'Есть цены — можно сравнивать предложения.', next: 'Агент продолжит открытые переписки.' }
  if (stopped) return { now: 'Закупка настроена без рассылки: агент дальше не идёт.', next: 'Чтобы написать поставщикам, измените настройки закупки.' }
  if (status === 'waiting') {
    if (member.waitingFor === 'SUPPLIER_EVIDENCE') return { now: 'Поиск не нашёл подходящих поставщиков.', next: 'Найдите поставщика вручную или запустите поиск снова.' }
    if (member.waitingFor === 'SUPPLIER_CONTACT') return { now: 'У выбранных компаний нет контактов.', next: 'Добавьте контакт, и агент сможет написать.' }
    if (at === COMPANIES) {
      return {
        now: 'Подтвердите, кому писать.',
        next: plan?.approveRfq === false
          ? 'После подтверждения агент сразу напишет выбранным компаниям.'
          : 'Затем вы проверите текст запроса. Письма пока не уходят.',
      }
    }
    if (at === RFQ) {
      const count = member.verifiedCount
      return {
        now: 'Проверьте текст запроса.',
        next: count
          ? `После согласования агент напишет подтверждённым компаниям: ${count}.`
          : 'После согласования агент напишет подтверждённым компаниям.',
      }
    }
    return { now: 'Проверьте письма перед отправкой.', next: 'После подтверждения они уйдут поставщикам.' }
  }
  if (at === SEARCH) {
    return {
      now: 'Агент ищет поставщиков и собирает контакты.',
      next: plan?.confirmCandidates === false ? 'Дальше он сам выберет компании по найденным доказательствам.' : 'Дальше вы подтвердите, кому писать.',
    }
  }
  if (at === SEND) return { now: 'Агент отправляет запросы.', next: 'От вас ничего не нужно. Ответы появятся здесь.' }
  if (answered) return { now: 'Есть ответы, но цены пока нет.', next: 'Подробности в предложениях и переписках ниже.' }
  return { now: 'Запросы отправлены, ждём ответы поставщиков.', next: 'От вас ничего не нужно. Ответы появятся здесь.' }
}

/** `offers` is the page's tally for this substance: its offers and how many of
 * them carry a price. An answer can arrive on the marketplace with no letter to
 * count it on, so the offers are read as well as the member's own counters. */
export function memberSteps(member, plan = {}, offers = {}) {
  const offerCount = Array.isArray(offers?.offers) ? offers.offers.length : offers?.offers || 0
  const priced = (offers?.priced || 0) > 0
  const answered = member.responseCount > 0 || offerCount > 0
  const current = position(member)
  // Finished with nothing sent: the plan stopped before the letters, so what
  // comes after is not late, it is not going to happen.
  const stopped = member.stage === 'DONE' && !member.requestCount && !answered
  const lastInReach = plan?.reach === 'SOURCING' ? SEARCH : plan?.reach === 'CONTACTS' ? COMPANIES : RESULT

  const steps = MEMBER_STEPS.map(([id, label], index) => {
    let status = 'todo'
    if (index < current.at) status = 'done'
    else if (index === current.at) status = current.status
    if (stopped) status = index <= Math.min(lastInReach, RFQ) ? 'done' : 'off'
    else if (index > lastInReach) status = 'off'
    return { id, label, status }
  })
  if (current.status !== 'failed' && !stopped) {
    if (answered) steps[REPLIES].status = 'done'
    if (priced) steps[RESULT].status = 'done'
    if (answered || priced) for (const index of [SEARCH, COMPANIES, RFQ, SEND]) steps[index].status = 'done'
  }
  return { steps, ...sentence(member, plan, current, { answered, priced, stopped }) }
}

/** The row's stage in words that hold once letters have gone: "Готово" beside
 * "агент работает" and no price read as a purchase with nothing left to do. */
export function memberStageLabel(member, labels) {
  if (member.stage === 'DONE' && member.requestCount) return 'Запросы отправлены'
  return labels[member.stage] || member.stage
}
