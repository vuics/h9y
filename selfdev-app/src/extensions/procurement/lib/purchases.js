/** The purchases home: typed substances in, one line per purchase out. */

const CAS = /\b\d{2,7}-\d{2}-\d\b/

/** One substance per line: a CAS number, a name, or both in any order. */
export function parseSubstances(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const cas = line.match(CAS)?.[0] || ''
      const name = (cas ? line.replace(cas, ' ') : line)
        .replace(/\b(CAS|КАС)\b\s*(№|No\.?|#)?\s*:?/gi, ' ')
        // A comma inside a name ("2,4-Dichlorophenol") is part of it; only a
        // comma beside a space or at an edge separates the name from the CAS.
        .replace(/[\t;|]+/g, ' ')
        .replace(/,(?=\s|$)|(^|\s),/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return { name, cas }
    })
    .filter(item => item.name || item.cas)
}

const quote = value => `"${String(value).replace(/"/g, '""')}"`

/** The typed list as the table the file import already reads.
 *
 * Going through the import rather than straight to a card keeps one path for
 * one substance and for two hundred: the same recognition, duplicate check and
 * PubChem pass, and a campaign launched the same way.
 */
export function substancesToCsv(items) {
  return ['Наименование,CAS', ...items.map(item => `${quote(item.name)},${quote(item.cas)}`)].join('\n')
}

export function typedListFilename(items, now = new Date()) {
  if (items.length === 1) return `${(items[0].name || items[0].cas).slice(0, 60)}.csv`
  const stamp = now.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')
  return `Список ${stamp}.csv`
}

export function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const STAGE_SENTENCE = {
  QUEUED: ['В очереди на поиск', 'progress'],
  SOURCING: ['Ищем поставщиков', 'progress'],
  CONTACTS: ['Собираем контакты', 'progress'],
  AWAITING_REVIEW: ['Ждёт вашего согласования', 'warning'],
  OUTREACH: ['Рассылаем запросы', 'progress'],
  NEGOTIATION: ['Идут переговоры', 'progress'],
  DONE: ['Готово', 'complete'],
  FAILED: ['Не удалось пройти', 'danger'],
  SKIPPED: ['Пропущено: карточку нельзя искать', 'muted'],
}

const plural = (count, one, few, many) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** What a purchase is doing, in one sentence and one colour.
 *
 * The list used to answer with five numeric columns; the question a purchaser
 * brings to it is "is anything waiting for me, and is anything in yet".
 */
export function purchaseSentence(row) {
  const progress = row.progress || {}
  switch (row.status) {
    case 'CANCELLED': return { text: 'Остановлена', tone: 'muted' }
    case 'PAUSED': return { text: 'На паузе', tone: 'muted' }
    case 'INTERRUPTED': return { text: 'Прервана перезапуском — откройте и нажмите «Продолжить»', tone: 'warning' }
    case 'FAILED': return { text: 'Не выполнена', tone: 'danger' }
    default: break
  }
  if (progress.awaitingReview > 0) {
    const count = progress.awaitingReview
    return { text: `Ждёт вашего согласования: ${count} ${plural(count, 'вещество', 'вещества', 'веществ')}`, tone: 'warning' }
  }
  if (progress.responseTotal > 0) {
    const count = progress.responseTotal
    return { text: `${count} ${plural(count, 'ответ', 'ответа', 'ответов')} поставщиков на ${progress.requestTotal} ${plural(progress.requestTotal, 'запрос', 'запроса', 'запросов')}`, tone: 'complete' }
  }
  if (progress.requestTotal > 0) {
    const count = progress.requestTotal
    return { text: `Отправлено ${count} ${plural(count, 'запрос', 'запроса', 'запросов')}, ждём ответов`, tone: 'progress' }
  }
  if (row.substance && STAGE_SENTENCE[row.substance.stage]) {
    const [text, tone] = STAGE_SENTENCE[row.substance.stage]
    return { text, tone }
  }
  if (row.status === 'COMPLETED') return { text: 'Завершена', tone: 'complete' }
  const byStage = progress.byStage || {}
  if (byStage.SOURCING || byStage.QUEUED) return { text: 'Ищем поставщиков', tone: 'progress' }
  if (byStage.CONTACTS) return { text: 'Собираем контакты', tone: 'progress' }
  return { text: 'Идёт', tone: 'progress' }
}

/** "4 вещества", "1 вещество": the same words for every purchase. */
export function purchaseSize(row) {
  const total = row.progress?.total || 0
  if (!total) return ''
  return `${total} ${plural(total, 'вещество', 'вещества', 'веществ')}`
}

/** What the search field holds, so it searches before it creates.
 *
 * A bare number is a card number — never a new substance called "381". One
 * line is looked up in the register first; only a list (or a file) goes
 * straight to the import, which checks each line for duplicates itself.
 */
export function classifyQuery(text) {
  const value = String(text || '').trim()
  if (!value) return { kind: 'empty', value }
  if (parseSubstances(value).length > 1) return { kind: 'list', value }
  const number = value.match(/^#?\s*(\d+)$/)
  if (number) return { kind: 'number', value: number[1] }
  if (CAS.test(value) && value.replace(CAS, '').trim() === '') return { kind: 'cas', value: value.match(CAS)[0] }
  return { kind: 'name', value }
}
