/** The four RFQ documents a card carries, and how to read one out of a bundle.
 *
 * Long and short versions exist because the customer asked for a shorter first
 * message but the full document is still the right thing to send once a
 * conversation is established. Which one to rehearse against is therefore a real
 * choice, not a default.
 */

export const RFQ_VERSIONS = [
  ['english_short', 'EN короткий'],
  ['russian_short', 'RU короткий'],
  ['english', 'EN полный'],
  ['russian', 'RU полный'],
]

const CANDIDATE_KEYS = {
  english_short: ['englishShort', 'english_short'],
  russian_short: ['russianShort', 'russian_short'],
  english: ['english'],
  russian: ['russian'],
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
