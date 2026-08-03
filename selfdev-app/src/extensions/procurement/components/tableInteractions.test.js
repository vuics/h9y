import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldOpenTableRow } from './tableInteractions.js'

const event = interactive => ({ target: { closest: () => interactive ? {} : null } })

test('selecting table text does not open the row', () => {
  const selection = { isCollapsed: false, toString: () => 'Worker Test Supplier' }
  assert.equal(shouldOpenTableRow(event(false), selection), false)
})

test('interactive controls do not delegate their action to the row', () => {
  assert.equal(shouldOpenTableRow(event(true), { isCollapsed: true, toString: () => '' }), false)
})

test('an ordinary row click still opens the entity', () => {
  assert.equal(shouldOpenTableRow(event(false), { isCollapsed: true, toString: () => '' }), true)
})
