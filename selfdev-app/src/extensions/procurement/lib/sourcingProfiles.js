/** A purchase profile: the kind of purchase, and the search plan it needs.
 *
 * The settings screens read one list of queries; this points that list at the
 * chosen profile, so everything that counts or sends queries follows the choice
 * without knowing profiles exist. A server without profiles leaves it as it is.
 */
export function profileSettings(settings, profileId) {
  const profile = settings.profiles?.find(item => item.id === profileId)
    ?? settings.profiles?.find(item => item.id === settings.defaultProfileId)
  if (!profile) return settings
  return {
    ...settings,
    profileId: profile.id,
    templates: profile.templates,
    isDefault: profile.isDefault,
    defaultTemplates: profile.defaultTemplates,
    defaultQueryIds: profile.templates.filter(item => item.enabled).map(item => item.id),
    profileValues: profile.settings,
    synonymLimit: profile.settings?.synonymLimit ?? settings.synonymLimit,
  }
}

/** How deep each query goes, as a choice rather than a number; see `SourcingSettings`. */
export const DEPTHS = [
  { id: 'FAST', perQuery: 2, label: 'Быстрый', detail: 'По 2 результата на запрос — хватает, чтобы увидеть, есть ли вообще кто-то.' },
  { id: 'NORMAL', perQuery: 5, label: 'Обычный', detail: 'По 5 на запрос. Разумный выбор для закупки по длинному списку.' },
  { id: 'MAX', perQuery: 10, label: 'Максимальный', detail: 'По 10 — это потолок, выше поисковые движки не отдают.' },
]

/** What a candidate's rating is about. */
export const RATINGS = [
  { id: 'SELLER', label: 'Продавец', detail: 'Где купить: вещество на сайте компании, цена, наличие, поставщик в России.' },
  { id: 'MAKER', label: 'Производитель', detail: 'Кто производит: официальный сайт, заявленное производство, разрешения. Торговцы получают меньше баллов.' },
]

export const plural = (count, one, few, many) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** What a run will search with: this launch's own choices over the profile's.
 * A setting left null follows the profile, so choosing another profile needs only
 * to clear them. A source this installation lacks is simply not used. */
export function effectiveSourcing(value, settings) {
  const profile = settings.profileValues ?? {}
  const available = settings.availableEngineIds ?? []
  return {
    depth: value.depth ?? profile.depth ?? 'NORMAL',
    siteProbe: value.siteProbe ?? profile.siteProbe ?? true,
    engineIds: (value.engineIds ?? profile.engineIds ?? available).filter(id => available.includes(id)),
    queryIds: value.queryIds ?? settings.defaultQueryIds ?? [],
    synonymLimit: value.synonymLimit ?? settings.synonymLimit ?? 0,
    ratingMode: value.ratingMode ?? profile.ratingMode ?? 'MAKER',
  }
}

const sameSet = (left, right) =>
  left.length === right.length && left.every(item => right.includes(item))

/** Where this launch differs from its profile, as the fields to save into it.
 * Queries are left out: their checkboxes mean this run only, and the list has its
 * own editor. So is depth where the form does not take it from the profile. */
export function profileChanges(value, settings) {
  const profile = settings.profileValues
  if (!profile) return {}
  const current = effectiveSourcing(value, settings)
  const saved = effectiveSourcing({}, settings)
  return {
    ...(value.profileDepth && current.depth !== saved.depth ? { depth: current.depth } : {}),
    ...(current.siteProbe !== saved.siteProbe ? { siteProbe: current.siteProbe } : {}),
    ...(sameSet(current.engineIds, saved.engineIds) ? {} : { engineIds: current.engineIds }),
    ...(current.ratingMode !== saved.ratingMode ? { ratingMode: current.ratingMode } : {}),
  }
}

/** The collapsed section's line: what this launch will do, in the order it matters. */
export function profileSummary(value, settings) {
  const current = effectiveSourcing(value, settings)
  const templates = settings.templates ?? []
  const selected = templates.filter(item => current.queryIds.includes(item.id))
  const total = templates.length
  const russian = selected.filter(item => CYRILLIC.test(String(item.template))).length
  const region = !selected.length ? ''
    : russian === selected.length ? ', поиск по России'
      : russian ? ', поиск по России и миру' : ', поиск по миру'
  const queries = selected.length === total
    ? `${total} ${plural(total, 'запрос', 'запроса', 'запросов')}`
    : `${selected.length} из ${total} ${plural(total, 'запроса', 'запросов', 'запросов')}`
  const engines = settings.engineList ?? []
  const label = id => engines.find(engine => engine.id === id)?.label ?? id
  const missing = (settings.profileValues?.engineIds ?? [])
    .filter(id => !(settings.availableEngineIds ?? []).includes(id))
  return [
    queries + region,
    current.engineIds.map(label).join(', ') || 'нет доступных источников',
    `глубина «${DEPTHS.find(item => item.id === current.depth)?.label ?? current.depth}»`,
    current.siteProbe ? 'сайт проверяем' : 'сайт не проверяем',
    `рейтинг: ${RATINGS.find(item => item.id === current.ratingMode)?.label.toLowerCase() ?? current.ratingMode}`,
    ...(missing.length ? [`недоступно: ${missing.map(label).join(', ')}`] : []),
  ]
}

/** The profile a stored plan reopens on. A plan with a selection and no profile
 * was made when production's list was the only one. */
export const profileOfPlan = plan =>
  plan?.queryProfileId ?? (plan?.queryTemplateIds ? 'production' : null)

/** The profile a stored plan reopens on, and whether that profile has since been
 * deleted. A deleted one has no list to show the plan's selection in, so the form
 * opens on the default profile; the campaign itself keeps its queries until
 * someone saves other settings over them. */
export function planProfile(plan, profiles = []) {
  const profileId = profileOfPlan(plan)
  if (!profileId || !profiles.length || profiles.some(item => item.id === profileId)) {
    return { profileId, deleted: false }
  }
  return { profileId: null, deleted: true }
}

export const MAX_PROFILE_NAME_LENGTH = 60

/** Why this name cannot be saved, in the words the form shows; null when it can.
 * The server refuses the same three, in English, for a caller without this form. */
export function profileNameProblem(name, profiles = [], ownId = null) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return 'Укажите название профиля.'
  if (clean.length > MAX_PROFILE_NAME_LENGTH) return `Название длиннее ${MAX_PROFILE_NAME_LENGTH} символов.`
  const key = clean.toLocaleLowerCase('ru')
  if (profiles.some(item => item.id !== ownId && item.name.toLocaleLowerCase('ru') === key)) {
    return 'Профиль с таким названием уже есть.'
  }
  return null
}

const CYRILLIC = /[а-яё]/i

/** The backend does not repeat a Russian query for a Latin synonym, and the
 * synonyms it searches are PubChem's, so only the other queries multiply. */
export const multipliedBySynonyms = template =>
  String(template).includes('{name}') && !CYRILLIC.test(String(template))
