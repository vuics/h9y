/** How to name the link we hold for a supplier.
 *
 * Registering a supplier from a marketplace stores the inquiry page we found
 * them on, not the company's own site. Three of the ten suppliers with a URL
 * on file point at Echemi, so calling every one of them "the supplier's
 * website" would state something untrue about a third of them.
 */
const MARKETPLACES = [
  [/(^|\.)echemi\.com$/i, 'Профиль на Echemi'],
]

/** The host a URL points at, or null when it is not a URL we can read. */
export function hostOf(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function supplierLinkLabel(url) {
  const host = hostOf(url)
  if (!host) return 'Сайт поставщика'
  const known = MARKETPLACES.find(([pattern]) => pattern.test(host))
  return known ? known[1] : 'Сайт поставщика'
}
