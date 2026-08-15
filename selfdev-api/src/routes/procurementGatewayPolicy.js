/** What the browser may reach, on top of the generated endpoint inventory.
 *
 * `procurementEndpoints.js` is generated from the procurement OpenAPI document,
 * so the gateway can never again fall behind the API — that drift silently broke
 * bulk card import and the web-form RFQ contour once already.
 *
 * Generation alone would make the gateway a pass-through of whatever the service
 * declares, which costs a layer of defence: a new upstream endpoint would become
 * browser-reachable the moment it shipped. This file keeps the gateway able to
 * be stricter than the API. Entries are matched against the generated inventory,
 * so a stale rule here is reported rather than silently ignored.
 *
 * The upstream service remains the authority on permissions: it re-reads the
 * user and derives them itself, and does not trust anything forwarded here.
 */

/** Endpoints that exist in the API but must not be proxied to a browser. */
export const GATEWAY_DENIED = [
  {
    method: 'GET',
    path: '/capabilities',
    // The workspace already receives its permissions through the extension
    // registry, so proxying this would add a second, divergent source for them.
    reason: 'Permissions reach the browser through /extensions instead.',
  },
]

export function isDenied(method, path) {
  return GATEWAY_DENIED.some(entry => entry.method === method && entry.path === path)
}
