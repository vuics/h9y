/** The workspace's navigation: three tabs, everything else in one menu.
 *
 * The purchases are where the work happens. Escalations stay a tab for their
 * counter as much as for the list: it shows the agent is waiting on a person
 * from any screen, before a purchase is opened. The dashboard is the
 * manager's view of whether the system works. The offers list moved to the
 * menu: each position's offers are on its purchase, and a list across all of
 * them is a reference, not a daily task. Every other screen stays one click
 * away in "Все разделы" with its address unchanged: links in letters, in the
 * chat and in bookmarks keep working.
 */

export const PRIMARY_SECTIONS = [
  ['purchases', 'Закупки', '/procurement'],
  ['escalations', 'Эскалации', '/procurement/escalations'],
  ['dashboard', 'Дашборд', '/procurement/dashboard'],
]

export const MORE_SECTIONS = [
  ['proposals', 'Предложения', '/procurement/proposals'],
  ['overview', 'Обзор этапов', '/procurement/overview'],
  ['requests', 'Карточки позиций', '/procurement/requests'],
  ['suppliers', 'Поставщики', '/procurement/suppliers'],
  ['negotiations', 'Переговоры', '/procurement/negotiations'],
  ['agent', 'Что делает агент', '/procurement/negotiations/agent'],
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
  ['requests', 'Карточки позиций', '/procurement/requests'],
  ['purchases', 'Закупки', '/procurement'],
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
  // The longest matching path wins: «Что делает агент» lives under
  // /procurement/negotiations and is its own section, not «Переговоры».
  const match = all
    .filter(([, , to]) => to !== '/procurement')
    .filter(([, , to]) => path === to || path.startsWith(`${to}/`))
    .sort(([, , a], [, , b]) => b.length - a.length)[0]
  return match?.[0] || 'purchases'
}

export const isPrimarySection = key => PRIMARY_SECTIONS.some(([id]) => id === key)

export const sectionLabel = key =>
  [...PRIMARY_SECTIONS, ...MORE_SECTIONS].find(([id]) => id === key)?.[1]

export const sectionPath = (key, sections = PRIMARY_SECTIONS) =>
  sections.find(([id]) => id === key)?.[2]
