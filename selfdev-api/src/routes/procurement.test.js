import test from 'node:test'
import assert from 'node:assert/strict'
import { identityHeaders } from './extensions.js'
import { isAllowedProcurementRequest, isReadableProcurementPath, normalizeProcurementResponse } from './procurement.js'

test('gateway exposes only the explicitly allow-listed read API', () => {
  assert.equal(isReadableProcurementPath('/overview'), true)
  assert.equal(isReadableProcurementPath('/cards/1042'), true)
  assert.equal(isReadableProcurementPath('/proposals/compare'), true)
  assert.equal(isReadableProcurementPath('/admin/raw-collections'), false)
  assert.equal(isReadableProcurementPath('/cards/1042/delete'), false)
})

test('gateway allow-lists only the deterministic card mutations', () => {
  assert.equal(isAllowedProcurementRequest('POST', '/cards'), true)
  assert.equal(isAllowedProcurementRequest('PATCH', '/cards/42'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/normalize'), true)
  assert.equal(isAllowedProcurementRequest('GET', '/cards/42/rfq'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/rfq/prepare'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/rfq/approve'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/suppliers'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/suppliers/SUP-1/capabilities'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/suppliers/SUP-1/contacts'), true)
  assert.equal(isAllowedProcurementRequest('PATCH', '/suppliers/SUP-1/contacts/CONTACT-1'), true)
  assert.equal(isAllowedProcurementRequest('PATCH', '/suppliers/SUP-1/qualification'), true)
  assert.equal(isAllowedProcurementRequest('DELETE', '/cards/42'), false)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/approve-rfq'), false)
})

test('gateway replaces client identity with the authenticated Selfdev user', () => {
  const headers = identityHeaders({
    _id: 'user-42',
    email: 'buyer@example.test',
    roles: ['admin'],
  })
  assert.equal(headers['x-selfdev-subject-id'], 'user-42')
  assert.equal(headers['x-selfdev-subject-email'], 'buyer@example.test')
  assert.equal(headers['x-selfdev-subject-roles'], undefined)
  assert.equal(headers.accept, 'application/json')
})

test('gateway exposes safe user-facing FastAPI errors', () => {
  assert.deepEqual(normalizeProcurementResponse(403, {
    detail: { code: 'PERMISSION_DENIED', message: 'Permission AUDIT_READ is required.' },
  }), {
    result: 'error',
    code: 'PERMISSION_DENIED',
    message: 'Permission AUDIT_READ is required.',
  })
  assert.deepEqual(normalizeProcurementResponse(200, { items: [] }), { items: [] })
})
