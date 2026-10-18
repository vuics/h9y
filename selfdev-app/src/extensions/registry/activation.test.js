import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateExtensionActivation } from './activation.js'

const capability = { id: 'procurement', enabled: true, apiVersion: 1, permissions: ['CARD_READ'] }

test('extension activates only when build, runtime, version and permissions agree', () => {
  assert.equal(evaluateExtensionActivation({ buildAvailable: true, capability, requiredPermissions: ['CARD_READ'] }).active, true)
})

test('missing permission denies activation', () => {
  const result = evaluateExtensionActivation({ buildAvailable: true, capability, requiredPermissions: ['AUDIT_READ'] })
  assert.equal(result.state, 'permission-denied')
  assert.deepEqual(result.missingPermissions, ['AUDIT_READ'])
})

test('incompatible API is rejected before loading the extension', () => {
  assert.equal(evaluateExtensionActivation({ buildAvailable: true, capability: { ...capability, apiVersion: 2 } }).state, 'incompatible')
})

test('extension missing from the build cannot activate', () => {
  assert.equal(evaluateExtensionActivation({ buildAvailable: false, capability }).state, 'build-unavailable')
})

test('an unreachable service is unavailable, not a refusal', () => {
  // What the API answers while the procurement service restarts: no
  // permissions, because it could not ask.
  const restarting = { ...capability, permissions: [], serviceAvailable: false }
  const result = evaluateExtensionActivation({ buildAvailable: true, capability: restarting, requiredPermissions: ['CARD_READ'] })
  assert.equal(result.state, 'service-unavailable')
  assert.equal(result.active, false)
})

test('a service that answered without the permission is a refusal', () => {
  const answered = { ...capability, permissions: [], serviceAvailable: true }
  assert.equal(evaluateExtensionActivation({ buildAvailable: true, capability: answered, requiredPermissions: ['CARD_READ'] }).state, 'permission-denied')
})
