import test from 'node:test'
import assert from 'node:assert/strict'
import { isReadableProcurementPath } from './procurement.js'

test('gateway exposes only the explicitly allow-listed read API', () => {
  assert.equal(isReadableProcurementPath('/overview'), true)
  assert.equal(isReadableProcurementPath('/cards/1042'), true)
  assert.equal(isReadableProcurementPath('/proposals/compare'), true)
  assert.equal(isReadableProcurementPath('/admin/raw-collections'), false)
  assert.equal(isReadableProcurementPath('/cards/1042/delete'), false)
})
