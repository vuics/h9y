export const EXTENSION_API_VERSION = 1

export function evaluateExtensionActivation({
  buildAvailable,
  capability,
  requiredPermissions = [],
}) {
  if (!buildAvailable) return { state: 'build-unavailable', active: false }
  if (!capability) return { state: 'runtime-unavailable', active: false }
  if (!capability.enabled) return { state: 'disabled', active: false }
  if (capability.apiVersion !== EXTENSION_API_VERSION) {
    return { state: 'incompatible', active: false }
  }
  // Before the permissions: an unreachable service reports none, and reading
  // that as a refusal told people with access "Access denied" during every
  // redeploy of the procurement service.
  if (capability.serviceAvailable === false) {
    return { state: 'service-unavailable', active: false }
  }
  const permissions = new Set(capability.permissions || [])
  const missingPermissions = requiredPermissions.filter(
    permission => !permissions.has(permission),
  )
  if (missingPermissions.length) {
    return { state: 'permission-denied', active: false, missingPermissions }
  }
  return { state: 'active', active: true }
}
