/** View-model rules for the negotiation thread.
 *
 * Kept out of the component for the same reason `timeline.js` is: these are the
 * rules that decide what a specialist sees marked, which channel a message may
 * leave through, and how much of a four-thousand-character RFQ is shown before
 * it buries the reply under it — all of them testable without a browser.
 */

export const CHANNEL_LABELS = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  xmpp: 'XMPP',
  wechat: 'WeChat',
  telegram: 'Telegram',
  phone: 'Телефон',
  web_form: 'Веб-форма',
  manual_web: 'Ручной ввод',
  web_upload: 'Загрузка файла',
}

export const channelLabel = channel => CHANNEL_LABELS[channel] || channel || 'Канал не указан'

/** Card fields a change can touch, named as the requirement names them. */
export const CHANGE_FIELD_LABELS = {
  cas_number: 'CAS',
  substance_name: 'Вещество',
  purity: 'Чистота',
  application_area: 'Область применения',
  target_volume: 'Количество',
  price_guideline: 'Ориентир цены',
}

/** Split a text into runs, marking the ranges an extracted value came from.
 *
 * The offsets are the backend's, resolved against the stored message, so the
 * only thing decided here is what happens to a range that no longer fits —
 * which is that it is skipped. Painting a stale range would underline the
 * wrong words and quietly claim the supplier said something they did not.
 */
export function highlightSegments(text = '', spans = []) {
  const body = String(text ?? '')
  if (!body || !spans.length) return [{ text: body, span: null }]
  const ordered = [...spans]
    .filter(span => Number.isInteger(span?.start) && Number.isInteger(span?.end))
    .filter(span => span.start >= 0 && span.end <= body.length && span.end > span.start)
    .sort((left, right) => left.start - right.start)
  const segments = []
  let cursor = 0
  for (const span of ordered) {
    if (span.start < cursor) continue
    if (span.start > cursor) segments.push({ text: body.slice(cursor, span.start), span: null })
    segments.push({ text: body.slice(span.start, span.end), span })
    cursor = span.end
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor), span: null })
  return segments
}

/** Contacts a message may actually be sent to, in the picker's order.
 *
 * Only what the supplier directory holds: the thread offers the addresses that
 * exist, never an empty "email" the deployment has no address for.
 */
export function selectableContacts(contacts = []) {
  return contacts.filter(contact => contact.usable)
}

/** Why a channel cannot carry a message, phrased for the picker. */
export function contactWarning(contact) {
  if (!contact) return 'Контакт не выбран.'
  if (contact.active === false) return 'Контакт отключён в справочнике поставщика.'
  if (contact.verificationStatus === 'INVALID') return 'Адрес помечен как недействительный.'
  if (contact.channel === 'xmpp' && contact.verificationStatus !== 'VERIFIED') {
    return 'XMPP-контакт должен быть подтверждён.'
  }
  if (!contact.workerDispatch) {
    return 'Форма на сайте заполняется в браузерном контуре с отдельным подтверждением, worker её не отправляет.'
  }
  return null
}

const LONG_TEXT_LINES = 8
const LONG_TEXT_CHARS = 700

/** Whether a message is long enough to be shown folded by default. */
export function isLongText(text = '', { lines = LONG_TEXT_LINES, chars = LONG_TEXT_CHARS } = {}) {
  const body = String(text ?? '')
  return body.length > chars || body.split('\n').length > lines
}

/** The opening of a long message, cut on a line boundary. */
export function textPreview(text = '', { lines = LONG_TEXT_LINES, chars = LONG_TEXT_CHARS } = {}) {
  const body = String(text ?? '')
  const head = body.split('\n').slice(0, lines).join('\n')
  return head.length > chars ? `${head.slice(0, chars)}…` : head
}

/** Which side of the thread an entry is drawn on. */
export function threadSide(entry) {
  if (entry.kind === 'message') return entry.message.kind === 'supplier' ? 'in' : 'out'
  if (entry.kind === 'composition' || entry.kind === 'planned') return 'out'
  if (entry.kind === 'quote') return 'in'
  return 'system'
}

const DELIVERY_LABELS = {
  DISPATCHED_TO_BRIDGE: 'Передано в мост',
  DISPATCHED_TO_XMPP: 'Отправлено',
  DELIVERED: 'Доставлено',
  RECEIVED: 'Получено',
  RECORDED: 'Зафиксировано',
  FAILED: 'Не доставлено',
}

export const deliveryLabel = status => DELIVERY_LABELS[status] || status || 'Статус неизвестен'

/** Human counter to a scheduled moment: "через 3 ч", "12 мин назад". */
export function relativeTime(value, now = Date.now()) {
  const at = Date.parse(value ?? '')
  if (Number.isNaN(at)) return null
  const minutes = Math.round((at - now) / 60000)
  const ahead = minutes >= 0
  const size = Math.abs(minutes)
  const text = size < 60 ? `${size} мин`
    : size < 60 * 24 ? `${Math.round(size / 60)} ч`
      : `${Math.round(size / (60 * 24))} дн`
  return ahead ? `через ${text}` : `${text} назад`
}

/** What time it is where the supplier is, when the directory knows.
 *
 * A follow-up that lands at three in the morning in Shandong is a lost day, so
 * the hour at the other end belongs next to the field that schedules it.
 */
export function supplierLocalTime(timezone, now = new Date()) {
  if (!timezone) return null
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit',
    }).format(now)
  } catch {
    // An unknown zone in the directory must not take the page down with it.
    return null
  }
}

/** Why an approved message is still sitting here, if it is.
 *
 * Approval queues the assignment on a best-effort basis: an escalated or paused
 * conversation refuses the queue, and the draft then waits with nothing on
 * screen saying so — it reads as sent-any-moment when it is not going anywhere.
 */
export function holdReason(negotiation) {
  if (!negotiation) return null
  if (negotiation.automationPaused) return 'автодействия приостановлены — возобновите их вверху страницы'
  if (negotiation.status === 'PAUSED_BY_CHANGE') return 'переговоры на паузе: сначала решите, что делать с изменением карточки'
  if (negotiation.status === 'ESCALATED') return 'открыта эскалация: сообщения не отправляются до решения'
  if (negotiation.status === 'STALE') return 'задание устарело и больше ничего не отправит'
  if (negotiation.status === 'CANCELLED') return 'переговоры остановлены'
  return null
}

/** How long the supplier has been silent, when that is the live question. */
export function silenceSince(negotiation, now = Date.now()) {
  const messages = negotiation?.messages || []
  const inbound = [...messages].reverse().find(item => item.kind === 'supplier')
  const last = inbound?.createdAt || negotiation?.lastDispatchAt
  const at = Date.parse(last ?? '')
  if (Number.isNaN(at)) return null
  const days = Math.floor((now - at) / 86400000)
  return days >= 1 ? days : null
}
