/** A campaign's history, said in Russian.
 *
 * Two levels, because the customer reads a campaign for two different things.
 * "Главное" is what happened to the campaign: launched, changed, held, sent,
 * decided. "Все события" adds each substance's own steps — search and contact
 * collection — which is what explains a campaign that stands still.
 */

const REACH = {
  SOURCING: 'только поиск',
  CONTACTS: 'поиск и контакты',
  OUTREACH: 'до рассылки запросов',
  NEGOTIATION: 'до сравнимых предложений',
}

const CAMPAIGN_STATUS = {
  RUNNING: 'идёт',
  AWAITING_REVIEW: 'ждёт согласования',
  COMPLETED: 'завершена',
  FAILED: 'не выполнена',
  PAUSED: 'на паузе',
  CANCELLED: 'остановлена',
  INTERRUPTED: 'прервана перезапуском',
}

const SETTING = {
  reach: 'Довести до',
  channels: 'Каналы',
  approve_rfq: 'Согласовать RFQ перед отправкой',
  confirm_candidates: 'Проверять найденных поставщиков',
  draft_first: 'Показывать каждое письмо',
  max_results: 'Источников на вещество',
  engine_ids: 'Источники поиска',
  query_template_ids: 'Поисковые запросы',
  site_probe: 'Проверять сайт кандидата',
}

const CHANNEL = { EMAIL: 'почта', WHATSAPP: 'WhatsApp', ECHEMI: 'Echemi', WEB_FORM: 'формы на сайтах' }

const settingValue = (key, value) => {
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (key === 'reach') return REACH[value] || value
  if (key === 'channels') return (value || []).map(item => CHANNEL[item] || item).join(', ') || 'нет'
  if (key === 'query_template_ids' || key === 'engine_ids') return value ? `${value.length} шт.` : 'по умолчанию'
  return value ?? '—'
}

const plural = (count, one, few, many) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const ERRORS = {
  SOURCING_REVIEW_REQUIRED: 'нет права подтверждать поставщиков',
  CARD_WRITE_REQUIRED: 'нет права согласовывать RFQ',
  CARD_NOT_NORMALIZED: 'карточка не нормализована',
  RFQ_NOT_READY: 'карточка не нормализована',
  CARD_INCOMPLETE: 'в карточке не заполнены поля',
  RFQ_NOT_PREPARED: 'RFQ не подготовлен',
}

const substance = event => event.data?.title || (event.cardId ? `#${event.cardId}` : '')

/** Each kind: whether it is a main line, and how it reads. */
const KINDS = {
  CREATED: { main: true, text: event => `Кампания запущена: ${event.data?.cards ?? '?'} ${plural(event.data?.cards ?? 0, 'вещество', 'вещества', 'веществ')}, ${REACH[event.data?.plan?.reach] || 'настройки по умолчанию'}` },
  PLAN_CHANGED: {
    main: true,
    text: event => {
      const changes = Object.entries(event.data?.changes || {})
        .map(([key, change]) => `${SETTING[key] || key}: ${settingValue(key, change.from)} → ${settingValue(key, change.to)}`)
      const requeued = event.data?.requeued ? `; продолжено веществ: ${event.data.requeued}` : ''
      return `Настройки изменены — ${changes.join('; ')}${requeued}`
    },
  },
  PAUSED: { main: true, text: () => 'Кампания поставлена на паузу' },
  UNPAUSED: { main: true, text: () => 'Кампания продолжена после паузы' },
  RESUMED: { main: true, text: () => 'Кампания продолжена после перезапуска' },
  INTERRUPTED: { main: true, text: () => 'Кампания прервана перезапуском сервиса' },
  CANCELLED: { main: true, text: () => 'Кампания остановлена совсем' },
  STATUS: { main: true, text: event => `Состояние кампании: ${CAMPAIGN_STATUS[event.data?.status] || event.data?.status}` },
  MEMBERS_ADDED: { main: true, text: event => `Добавлены вещества: ${(event.data?.cards || []).map(card => card.title).join(', ')}` },
  MEMBER_REMOVED: { main: true, text: event => `Вещество убрано из кампании: ${substance(event)}` },
  REVIEW_APPLIED: {
    main: true,
    text: event => `Согласовано: ${event.data?.verified ?? 0} ${plural(event.data?.verified ?? 0, 'решение', 'решения', 'решений')} по компаниям, ${event.data?.promoted ?? 0} в поставщики, RFQ — ${event.data?.rfqApproved ?? 0}`,
  },
  AUTOPILOT: {
    main: true,
    text: event => {
      const done = []
      if (event.data?.verified) done.push(`подтвердил ${event.data.verified} ${plural(event.data.verified, 'компанию', 'компании', 'компаний')}`)
      if (event.data?.rfqApproved) done.push('согласовал RFQ')
      const errors = (event.data?.errors || []).map(code => ERRORS[code] || code)
      const left = errors.length ? `; не сделано: ${errors.join(', ')}` : ''
      return `Агент по ${substance(event)}: ${done.join(', ') || 'ничего не сделал'}${left}`
    },
  },
  LETTERS_SENT: { main: true, text: event => `Отправлено запросов: ${event.data?.letters} по ${event.data?.substances || '?'} ${plural(event.data?.substances || 0, 'веществу', 'веществам', 'веществам')}` },
  MARKETPLACE_STARTED: { main: true, text: () => 'Заявки на площадку начали выставляться' },
  SEARCH_STARTED: { main: false, text: event => `${substance(event)}: поиск поставщиков начался` },
  SEARCH_ADOPTED: { main: false, text: event => `${substance(event)}: взят уже завершённый поиск, заново не искали` },
  SEARCH_FINISHED: { main: false, text: event => `${substance(event)}: поиск закончен, кандидатов ${event.data?.candidates ?? 0}` },
  SEARCH_FAILED: { main: true, text: event => `${substance(event)}: поиск не удался (${event.data?.code})` },
  CONTACTS_STARTED: { main: false, text: event => `${substance(event)}: сбор контактов начался` },
  CONTACTS_FINISHED: { main: false, text: event => `${substance(event)}: контакты собраны, компаний с контактами ${event.data?.contacts ?? 0}` },
  CONTACTS_FAILED: { main: false, text: event => `${substance(event)}: сбор контактов не удался (${event.data?.code})` },
  AWAITING_REVIEW: { main: false, text: event => `${substance(event)}: ждёт решения на экране согласования` },
  MEMBER_DONE: { main: false, text: event => `${substance(event)}: готово` },
}

export const historyLine = event => {
  const kind = KINDS[event.kind]
  return {
    main: kind ? kind.main : true,
    text: kind ? kind.text(event) : event.kind,
    // Who did it: a person's action names them; the campaign's own steps
    // and the agent's approvals are the machine's.
    who: event.kind === 'AUTOPILOT' ? 'агент' : event.actor ? 'специалист' : 'система',
  }
}

export const historyLevels = { main: 'Главное', all: 'Все события' }
