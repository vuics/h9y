/** Which organization the workspace works in, for a person in several.
 *
 * Kept in this browser only: it is a convenience, not a permission. Every
 * request carries it in a header and the procurement service decides — a
 * choice the person may not make is ignored there and they land in their own
 * organization, so a stale or edited value can never show anything more.
 */

export const ORGANIZATION_HEADER = 'x-procurement-organization'
const KEY = 'procurement.organization'
const ORGANIZATION_ID = /^[a-z][a-z0-9_]{1,31}$/

export function selectedOrganization(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(KEY) || ''
    return ORGANIZATION_ID.test(value) ? value : ''
  } catch {
    return ''
  }
}

export function selectOrganization(id, storage = globalThis.localStorage) {
  try {
    if (id && ORGANIZATION_ID.test(id)) storage?.setItem(KEY, id)
    else storage?.removeItem(KEY)
  } catch {
    // The choice lasts this page view only.
  }
}

export function organizationHeaders(storage = globalThis.localStorage) {
  const id = selectedOrganization(storage)
  return id ? { [ORGANIZATION_HEADER]: id } : {}
}
