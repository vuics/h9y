import test from 'node:test'
import assert from 'node:assert/strict'
import { loadExtensionState } from './loadState.js'
import { evaluateExtensionActivation } from './activation.js'

const manifest = { id: 'procurement', requiredPermissions: ['CARD_READ'] }
const manifestLoaders = { procurement: async () => ({ default: manifest }) }

test('an unanswered capability request keeps the manifests the build ships', async () => {
  const timeout = Object.assign(new Error('timeout of 20000ms exceeded'), { code: 'ECONNABORTED' })
  const state = await loadExtensionState({
    manifestLoaders,
    fetchCapabilities: async () => { throw timeout },
  })

  assert.deepEqual(state.manifests, { procurement: manifest })
  assert.equal(state.capabilities, null)
  assert.equal(state.error, timeout)
})

test('a slow network reads as a service to retry, not a section missing from the build', async () => {
  const state = await loadExtensionState({
    manifestLoaders,
    fetchCapabilities: async () => { throw new Error('Network Error') },
  })
  const activation = evaluateExtensionActivation({
    buildAvailable: Boolean(state.manifests.procurement),
    capability: state.capabilities?.extensions?.find(item => item.id === 'procurement'),
    requiredPermissions: manifest.requiredPermissions,
  })

  assert.equal(activation.state, 'runtime-unavailable')
})

test('an answered request returns the capabilities with the manifests', async () => {
  const capabilities = { extensions: [{ id: 'procurement', enabled: true }] }
  const state = await loadExtensionState({ manifestLoaders, fetchCapabilities: async () => capabilities })

  assert.deepEqual(state, { manifests: { procurement: manifest }, capabilities, error: null })
})

test('a manifest that fails to load is a broken build and is not swallowed', async () => {
  await assert.rejects(
    loadExtensionState({
      manifestLoaders: { procurement: async () => { throw new Error('chunk failed') } },
      fetchCapabilities: async () => ({ extensions: [] }),
    }),
    /chunk failed/,
  )
})
