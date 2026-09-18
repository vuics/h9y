/** The workspace's navigation: three tabs for the work, everything else in one menu.
 *
 * A purchaser does three things — starts a search, answers what the agent may
 * not decide, reads the offers — so those are the tabs. Every other screen
 * stays one click away in "Все разделы" with its address unchanged: links in
 * letters, in the chat and in bookmarks keep working.
 */

export const PRIMARY_SECTIONS = [
  ['purchases', 'Закупки', '/procurement'],
  ['escalations', 'Эскалации', '/procurement/escalations'],
  ['proposals', 'Предложения', '/procurement/proposals'],
]

export const MORE_SECTIONS = [
  ['overview', 'Обзор этапов', '/procurement/overview'],
  ['dashboard', 'Дашборд', '/procurement/dashboard'],
  ['requests', 'Карточки закупок', '/procurement/requests'],
  ['suppliers', 'Поставщики', '/procurement/suppliers'],
  ['negotiations', 'Переговоры', '/procurement/negotiations'],
  ['communication', 'Коммуникация', '/procurement/communication'],
  ['activity', 'Активность и ошибки', '/procurement/activity'],
  ['settings', 'Настройки', '/procurement/settings'],
  ['access', 'Доступ', '/procurement/access'],
]

// The full menu as it was before, kept behind «Классическое меню» for whoever
// already knows their way around it.
export const CLASSIC_SECTIONS = [
  ['dashboard', 'Дашборд', '/procurement/dashboard'],
  ['overview', 'Обзор', '/procurement/overview'],
  ['requests', 'Карточки закупок', '/procurement/requests'],
  ['purchases', 'Кампании', '/procurement'],
  ['suppliers', 'Поставщики', '/procurement/suppliers'],
  ['negotiations', 'Переговоры', '/procurement/negotiations'],
  ['proposals', 'Предложения', '/procurement/proposals'],
  ['escalations', 'Эскалации', '/procurement/escalations'],
  ['communication', 'Коммуникация', '/procurement/communication'],
  ['activity', 'Активность и ошибки', '/procurement/activity'],
]

const trimSlash = pathname => pathname.replace(/\/+$/, '') || '/'

/** Which section a path belongs to; campaign pages are purchases. */
export function sectionOf(pathname) {
  const path = trimSlash(pathname)
  if (path === '/procurement' || path.startsWith('/procurement/campaigns')) return 'purchases'
  const all = [...PRIMARY_SECTIONS, ...MORE_SECTIONS]
  const match = all
    .filter(([, , to]) => to !== '/procurement')
    .find(([, , to]) => path === to || path.startsWith(`${to}/`))
  return match?.[0] || 'purchases'
}

export const isPrimarySection = key => PRIMARY_SECTIONS.some(([id]) => id === key)

export const sectionLabel = key =>
  [...PRIMARY_SECTIONS, ...MORE_SECTIONS].find(([id]) => id === key)?.[1]

export const sectionPath = (key, sections = PRIMARY_SECTIONS) =>
  sections.find(([id]) => id === key)?.[2]
