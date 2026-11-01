/** A purchase profile: the kind of purchase, and the search plan it needs.
 *
 * The settings screens read one list of queries; this points that list at the
 * chosen profile, so everything that counts or sends queries follows the choice
 * without knowing profiles exist. A server without profiles leaves it as it is.
 */
export function profileSettings(settings, profileId) {
  const id = profileId ?? settings.defaultProfileId
  const profile = settings.profiles?.find(item => item.id === id)
  if (!profile) return settings
  return {
    ...settings,
    profileId: profile.id,
    templates: profile.templates,
    isDefault: profile.isDefault,
    defaultTemplates: profile.defaultTemplates,
    defaultQueryIds: profile.templates.filter(item => item.enabled).map(item => item.id),
  }
}

/** The profile a stored plan reopens on. A plan with a selection and no profile
 * was made when production's list was the only one. */
export const profileOfPlan = plan =>
  plan?.queryProfileId ?? (plan?.queryTemplateIds ? 'production' : null)

const CYRILLIC = /[а-яё]/i

/** The backend does not repeat a Russian query for a Latin synonym, and the
 * synonyms it searches are PubChem's, so only the other queries multiply. */
export const multipliedBySynonyms = template =>
  String(template).includes('{name}') && !CYRILLIC.test(String(template))
