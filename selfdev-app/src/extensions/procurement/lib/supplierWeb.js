/** What we can say about a supplier's web presence, and what we may not.
 *
 * Registering a supplier from a marketplace stores the inquiry page we found
 * them on, not the company's own site, so the two are named differently. And a
 * contact's email domain is a good guess at the site but never a fact: one
 * supplier on file writes from a free provider (163.com) and another from a
 * different company's domain entirely, which is why nothing here fills a field
 * on its own.
 */
const MARKETPLACES = [
  [/(^|\.)echemi\.com$/i, 'Профиль на Echemi'],
]

// Public mailboxes. A message from one says nothing about where the company
// keeps its website, so these are never offered as a candidate.
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.jp', 'hotmail.com',
  'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'mail.com', 'gmx.com', 'protonmail.com', 'proton.me', 'zoho.com',
  '163.com', '126.com', 'yeah.net', 'qq.com', 'foxmail.com', 'sina.com',
  'sina.cn', 'sohu.com', '21cn.com', 'aliyun.com', 'tom.com', '139.com',
  '189.cn', '188.com', 'vip.163.com', 'vip.qq.com', 'vip.sina.com',
  'yandex.ru', 'yandex.com', 'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',
  'rambler.ru', 'internet.ru',
])

// Enough of the multi-part suffixes to cover the countries we source from.
// Deliberately short: a wrong guess here only widens or narrows a comparison
// that a human is being asked to check anyway.
const MULTI_PART_SUFFIXES = new Set([
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.hk', 'com.tw', 'co.jp',
  'co.kr', 'co.uk', 'org.uk', 'com.au', 'co.in', 'com.br', 'com.sg',
  'com.my', 'com.tr', 'co.za',
])

/** The host a URL points at, or null when it is not a URL we can read. */
export function hostOf(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** The part of a host that identifies the company, `www.` and subdomains aside. */
export function registrableDomain(host) {
  const clean = String(host || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  if (!clean.includes('.')) return clean || null
  const labels = clean.split('.')
  const lastTwo = labels.slice(-2).join('.')
  const size = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2
  return labels.slice(-size).join('.')
}

export function emailDomain(address) {
  const at = String(address || '').lastIndexOf('@')
  if (at < 0) return null
  return registrableDomain(String(address).slice(at + 1))
}

export function isFreeMailDomain(domain) {
  const value = String(domain || '').toLowerCase()
  return FREE_MAIL.has(value) || FREE_MAIL.has(registrableDomain(value) || '')
}

export function supplierLinkLabel(url) {
  const host = hostOf(url)
  if (!host) return 'Сайт поставщика'
  const known = MARKETPLACES.find(([pattern]) => pattern.test(host))
  return known ? known[1] : 'Сайт поставщика'
}

/** Domains worth checking as this supplier's site, most-used first.
 *
 * Only a suggestion: the caller shows it, a person opens it and decides. A
 * domain that already matches the stored website is not offered again.
 */
export function websiteCandidates(contacts = [], website = null) {
  const current = registrableDomain(hostOf(website) || '')
  const counts = new Map()
  for (const contact of contacts) {
    if (contact?.channel !== 'email' || contact?.active === false) continue
    const domain = emailDomain(contact.address)
    if (!domain || isFreeMailDomain(domain) || domain === current) continue
    counts.set(domain, (counts.get(domain) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([domain]) => domain)
}

/** Contact domains that do not belong to the site we have on file.
 *
 * A soft signal, not an accusation: a company may legitimately run two
 * domains. It exists because the opposite — a contact quietly writing from
 * another company's domain — is exactly what a buyer should look at before
 * treating a quotation as that supplier's.
 */
export function websiteDomainMismatch(website, contacts = []) {
  const site = registrableDomain(hostOf(website) || '')
  if (!site) return []
  const marketplace = MARKETPLACES.some(([pattern]) => pattern.test(hostOf(website) || ''))
  if (marketplace) return []
  const seen = new Set()
  const mismatched = []
  for (const contact of contacts) {
    if (contact?.channel !== 'email' || contact?.active === false) continue
    const domain = emailDomain(contact.address)
    if (!domain || isFreeMailDomain(domain) || domain === site || seen.has(domain)) continue
    seen.add(domain)
    mismatched.push({ domain, address: contact.address, name: contact.name || null })
  }
  return mismatched
}
