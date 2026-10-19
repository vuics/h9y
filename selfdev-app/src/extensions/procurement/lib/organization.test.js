import test from 'node:test'
import assert from 'node:assert/strict'

import { organizationHeaders, selectOrganization, selectedOrganization } from './organization.js'

function memory() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('a chosen organization travels as a header', () => {
  const storage = memory()
  selectOrganization('beta', storage)
  assert.equal(selectedOrganization(storage), 'beta')
  assert.deepEqual(organizationHeaders(storage), { 'x-procurement-organization': 'beta' })
})

test('no choice sends no header', () => {
  assert.deepEqual(organizationHeaders(memory()), {})
})

test('a malformed value is neither stored nor sent', () => {
  const storage = memory()
  selectOrganization('Beta/../x', storage)
  assert.equal(selectedOrganization(storage), '')
  storage.setItem('procurement.organization', 'DROP')
  assert.deepEqual(organizationHeaders(storage), {})
})

test('clearing the choice returns to the default organization', () => {
  const storage = memory()
  selectOrganization('beta', storage)
  selectOrganization('', storage)
  assert.deepEqual(organizationHeaders(storage), {})
})

test('a storage that throws costs only the choice', () => {
  const broken = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  assert.equal(selectedOrganization(broken), '')
  assert.doesNotThrow(() => selectOrganization('beta', broken))
})
