/** The words and rules of a campaign's approval, shared by every screen that shows it. */

export const VERDICTS = [
  ['VERIFIED_MANUFACTURER', 'Производитель'],
  ['VERIFIED_DISTRIBUTOR', 'Дистрибьютор'],
  // Write to them for a price without vouching for who they are: the company
  // enters the directory unverified, and its offer says so.
  ['PRICE_REQUEST', 'Запросить цену'],
  ['NEEDS_MORE_EVIDENCE', 'Нужны доказательства'],
  ['REJECTED', 'Отклонить'],
]

// What the evidence already concluded, offered as the default verdict. The
// operator confirms or overrides it; nothing is submitted without them picking.
//
// `UNKNOWN` is a statement about our evidence, not about the company: the role
// extractor did not settle it, and on this campaign that is 51 of 121 rows —
// BOC Sciences, Lookchem, Fisher Scientific among them. So it defaults to
// "needs evidence" rather than to a rejection. The two are identical in what
// they permit — `require_promotable_candidate` writes to a supplier only on
// VERIFIED_MANUFACTURER, VERIFIED_DISTRIBUTOR or PRICE_REQUEST — and differ only in whether a
// real company is thrown away on no grounds, recorded under the specialist's
// own name. A verdict can be revised later; only the way back to UNREVIEWED is
// closed.
export const SUGGESTED = {
  MANUFACTURER: 'VERIFIED_MANUFACTURER',
  BOTH: 'VERIFIED_MANUFACTURER',
  DISTRIBUTOR: 'VERIFIED_DISTRIBUTOR',
  UNKNOWN: 'NEEDS_MORE_EVIDENCE',
}

// Only where the evidence actually concluded something. The rest are parked,
// and the row has to say so: marking all 121 "рекомендую" would erase the one
// distinction the screen exists to preserve — where there is a finding and
// where there is only an absence — and turn the preselect from saved clicks
// into a way to record decisions nobody read.
export const CONCLUDED = new Set(['MANUFACTURER', 'BOTH', 'DISTRIBUTOR'])

/** One decision is a candidate *under one substance*, never a candidate.
 *
 * The same company found for several substances carries the same
 * `SRC-CAND-…` id in every one of them — on this campaign 14 of 99 ids repeat
 * across the four blocks. Keyed by the id alone, one verdict stood for three
 * separate decisions and, because the radio `name` collided too, picking a
 * role for Dayang Chem under one substance visibly cleared it under another.
 */
export const verdictKey = (cardId, candidateId) => `${cardId}:${candidateId}`

const BLOCKED_LABEL = {
  STAGE_QUEUED: 'ещё не искали',
  STAGE_SOURCING: 'поиск ещё идёт',
  STAGE_CONTACTS: 'собираем контакты',
  STAGE_DONE: 'этот запуск не предполагал рассылку',
  STAGE_SKIPPED: 'пропущено',
  STAGE_FAILED: 'поиск не удался',
  CARD_INCOMPLETE: 'карточка — черновик, не хватает полей',
  RFQ_NOT_READY: 'карточка не нормализована',
  CARD_NOT_FOUND: 'карточка не найдена',
  SOURCING_ENGINE_UNAVAILABLE: 'ни один движок поиска не доступен',
  SOURCING_NOT_READY: 'поиск по карточке ещё не готов',
  CARD_NOT_NORMALIZED: 'карточка не нормализована',
  NO_USABLE_CONTACT: 'у поставщика нет контакта в разрешённых каналах закупки',
  STAGE_OUTREACH: 'запросы уже отправлены',
  STAGE_NEGOTIATION: 'идут переговоры',
}

export const mutationMessage = error => error?.response?.data?.message || error?.message
export const blockedText = code => BLOCKED_LABEL[code] || code

export const DECISION_LABEL = Object.fromEntries(VERDICTS)

/** Every reason a substance was not written to, flattened for one list.
 *
 * Per substance rather than as one count: "не отправлено по 3" tells the
 * specialist there is a problem and nothing about which substance has it.
 */
export const dispatchProblems = outreach => (outreach.results || []).flatMap(result =>
  (result.errors || []).map(error => ({ cardId: result.cardId, code: error.code })))

export const dispatchTitle = outreach => {
  if (outreach.queued > 0) return `Запросы отправлены: ${outreach.queued}`
  if (outreach.skipped === 'NEGOTIATION_QUEUE_REQUIRED') return 'Решения записаны, отправка ждёт прав'
  if (outreach.skipped === 'REACH_BELOW_OUTREACH') return 'Этот запуск не предполагал рассылку'
  return 'Отправлять было нечего'
}

/** Why the marketplace requests did or did not start on this approval.
 *
 * Reported rather than assumed: posting goes through one shared browser and
 * runs behind the response, so the approval can only say that it started —
 * the campaign page is where it is watched.
 */
export const MARKETPLACE_SKIPPED = {
  ECHEMI_NOT_IN_PLAN: 'Канал Echemi при запуске не выбирали — заявки на площадку по этой закупке не выставляются.',
  ECHEMI_OPERATE_REQUIRED: 'Заявки на площадку требуют разрешения ECHEMI_OPERATE. Решения записаны; выставить их сможет сотрудник с этим правом — со страницы закупки.',
  BUYER_DELIVERY_INCOMPLETE: 'Заявки на площадку не начаты: в настройках закупщика не хватает условий поставки. Заполните их и запустите со страницы закупки.',
}

/** Whether a substance of the approval still asks a person for something. */
export const reviewOpen = item => Boolean(item && !item.blockedBy && (
  item.normalization
  || item.candidates.some(candidate => candidate.reviewDecision === 'UNREVIEWED')
  || (item.rfq && item.rfq.status !== 'APPROVED')
))

// Verdicts that put a company on the list of those written to.
const WRITTEN_TO = new Set(['VERIFIED_MANUFACTURER', 'VERIFIED_DISTRIBUTOR', 'PRICE_REQUEST'])
// Stages that are past the approval: the position is not blocked, it is done.
const PAST_APPROVAL = new Set(['STAGE_OUTREACH', 'STAGE_NEGOTIATION'])

/** What the approval of one position has settled, as labels for its folded
 * header, coloured by who has to act: green done, amber waiting for you,
 * grey not yet, red wrong. The stage is in the table's own column; the
 * header says what was approved.
 */
export function reviewBadges(item) {
  if (!item) return []
  const badges = []
  if (item.normalization) badges.push({ tone: 'danger', label: 'идентичность не подтверждена' })
  const open = item.candidates.filter(candidate => candidate.reviewDecision === 'UNREVIEWED').length
  const approved = item.candidates.filter(candidate => WRITTEN_TO.has(candidate.reviewDecision)).length
  if (open && !item.blockedBy) badges.push({ tone: 'warning', label: `${open} на решении` })
  if (approved) badges.push({ tone: 'complete', label: `компаний подтверждено: ${approved}` })
  if (item.rfq?.status === 'APPROVED') badges.push({ tone: 'complete', label: 'RFQ согласован' })
  else if (item.rfq?.documentFingerprint) badges.push({ tone: 'warning', label: 'RFQ ждёт согласования' })
  else if (item.rfq) badges.push({ tone: 'muted', label: 'RFQ не подготовлен' })
  if (item.blockedBy && !PAST_APPROVAL.has(item.blockedBy) && !badges.length) {
    badges.push({ tone: 'muted', label: blockedText(item.blockedBy) })
  }
  if (!badges.length) badges.push({ tone: 'muted', label: 'нечего согласовывать' })
  return badges
}
