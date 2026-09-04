/** The RFQ a card carries, in each language, and how to read one out of a bundle.
 *
 * There used to be a long version beside the short one. Nothing sent it on
 * purpose, but it was the fallback wherever the short one was missing and it
 * was what every screen showed — eighteen suppliers received it that way. One
 * document per language removes the choice, and with it the mistake.
 */

export const RFQ_VERSIONS = [
  ['english', 'EN'],
  ['russian', 'RU'],
]

const CANDIDATE_KEYS = {
  // The short keys are still read: a bundle migrated by an older build, or one
  // being looked at mid-migration, carries the text under its former name.
  english: ['english', 'englishShort', 'english_short'],
  russian: ['russian', 'russianShort', 'russian_short'],
}

/** The message body of one version, or '' when the card has not got it yet.
 *
 * Tolerates both the camelCase projection and the raw snake_case document, and
 * both a plain string and an object carrying `emailText`/`text`, because the RFQ
 * bundle is read in several places and has grown a version at a time.
 */
export function rfqVersionText(bundle, version) {
  if (!bundle) return ''
  const document = bundle.rfq || bundle.versions || bundle
  for (const key of CANDIDATE_KEYS[version] || []) {
    const value = document?.[key]
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object') {
      const text = value.emailText || value.email_text || value.text || value.body
      if (typeof text === 'string' && text.trim()) return text
    }
  }
  return ''
}
