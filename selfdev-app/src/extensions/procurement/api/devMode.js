/** Demonstration mode: the workspace runs against fixtures instead of the API.
 *
 * Reads are answered from `devFixtures`; every mutation is refused, so a demo
 * can never look like it changed real procurement state.
 */

export const useDevFixtures = import.meta.env.DEV &&
  import.meta.env.VITE_PROCUREMENT_DEV_FIXTURES === 'true'

export async function fixtures() {
  return import('./devFixtures')
}

export function fixturesAreReadOnly() {
  const error = new Error('Изменения отключены в режиме демонстрационных данных.')
  error.code = 'DEV_FIXTURES_READ_ONLY'
  throw error
}

/** Wrap a mutation so demonstration mode refuses it.
 *
 * Replaces the `if (useDevFixtures) return fixturesAreReadOnly()` line that was
 * repeated in front of every mutating call, where one omission would have let a
 * demo issue a real write.
 */
export function mutation(call) {
  return (...args) => {
    if (useDevFixtures) return fixturesAreReadOnly()
    return call(...args)
  }
}

/** Wrap a read so demonstration mode answers it from fixtures. */
export function read(call, fromFixtures) {
  return (...args) => {
    if (useDevFixtures) return fromFixtures(...args)
    return call(...args)
  }
}

function matches(item, filters, keys) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('ru')
  if (search && !keys.some(key => JSON.stringify(item[key] ?? '').toLocaleLowerCase('ru').includes(search))) return false
  if (filters.status && ![item.status, item.stage, item.completeness, item.qualificationStatus].includes(filters.status)) return false
  if (filters.supplierId && item.supplierId !== filters.supplierId) return false
  if (filters.cardId && String(item.cardId ?? item.id) !== String(filters.cardId)) return false
  return true
}

function compareIds(left, right) {
  const numbers = [Number(left), Number(right)]
  if (numbers.every(value => Number.isFinite(value))) return numbers[0] - numbers[1]
  return String(left).localeCompare(String(right), 'ru')
}

export function fixturePage(items, filters, keys) {
  const filtered = items.filter(item => matches(item, filters, keys))
  if (filters.order) filtered.sort((a, b) => (filters.order === 'asc' ? 1 : -1) * compareIds(a.id, b.id))
  const page = Math.max(1, Number(filters.page || 1))
  const pageSize = Math.max(1, Number(filters.pageSize || 20))
  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length, hasMore: start + pageSize < filtered.length }
}
