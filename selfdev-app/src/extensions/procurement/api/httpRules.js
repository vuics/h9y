/** Transport rules with no dependencies, so they are directly testable.
 *
 * `http.js` imports axios and the app config, which a plain node test cannot
 * resolve; keeping the decisions here means the tests exercise the same code the
 * browser runs rather than a copy that can drift out of step with it.
 */

// How long each family of endpoints may take. A table rather than a chain of
// ternaries, because this is what gets edited whenever the backend grows another
// slow operation. The first match wins.
export const TIMEOUTS = [
  { ms: 180000, matches: path => path.includes('/responses') || path.includes('/sourcing') },
  { ms: 120000, matches: path => path.startsWith('/card-imports') || path.startsWith('/communication/imports') },
  { ms: 90000, matches: path => path.includes('/echemi') || path.includes('/web-form/') },
  // A rehearsal waits on the same model the rest of the contour uses, and the
  // gateway allows it 180s: giving the browser less would abandon a request the
  // server is still honestly working on.
  { ms: 180000, matches: path => path === '/communication/simulate' },
]

export const DEFAULT_TIMEOUT_MS = 15000

export function timeoutFor(path) {
  return TIMEOUTS.find(entry => entry.matches(path))?.ms ?? DEFAULT_TIMEOUT_MS
}

export function compactParams(filters = {}) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) =>
    value !== '' && value != null,
  ))
}

export const id = value => encodeURIComponent(value)
