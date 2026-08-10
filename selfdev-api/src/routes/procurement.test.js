import test from 'node:test'
import assert from 'node:assert/strict'
import { identityHeaders } from './extensions.js'
import { isAllowedProcurementRequest, isReadableProcurementPath, normalizeProcurementResponse } from './procurement.js'

test('gateway exposes only the explicitly allow-listed read API', () => {
  assert.equal(isReadableProcurementPath('/overview'), true)
  assert.equal(isReadableProcurementPath('/cards/1042'), true)
  assert.equal(isReadableProcurementPath('/cards/1042/sourcing'), true)
  assert.equal(isReadableProcurementPath('/sourcing/SRC-1042-A1B2'), true)
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
  assert.equal(isAllowedProcurementRequest('GET', '/cards/42/echemi'), true)
  assert.equal(isAllowedProcurementRequest('GET', '/cards/42/echemi/browser-access'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/echemi/search'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/echemi/inquiries'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/echemi/inquiries/ECHEMI-42-A1B2/preview'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/echemi/inquiries/ECHEMI-42-A1B2/approve'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/echemi/inquiries/ECHEMI-42-A1B2/submit'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/sourcing/runs'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/sourcing/SRC-42-A1B2/sources'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/sourcing/SRC-42-A1B2/candidates/CAND-1/review'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/sourcing/SRC-42-A1B2/candidates/CAND-1/promote'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/sourcing/SRC-42-A1B2/candidates/CAND-1/delete'), false)
  assert.equal(isAllowedProcurementRequest('POST', '/suppliers'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/suppliers/SUP-1/capabilities'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/suppliers/SUP-1/contacts'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/negotiations'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/negotiations/NEG-1/queue'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/negotiations/NEG-1/follow-up'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/negotiations/NEG-1/responses'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/proposals/RESP-1/clarification'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/escalations/ESC-1/claim'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/escalations/ESC-1/recommendations'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/escalations/ESC-1/resolution'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/escalations/ESC-1/delete'), false)
  assert.equal(isAllowedProcurementRequest('GET', '/proposals/export'), true)
  assert.equal(isAllowedProcurementRequest('GET', '/supplier-response-attachments/ATT-1'), true)
  assert.equal(isAllowedProcurementRequest('PATCH', '/suppliers/SUP-1/contacts/CONTACT-1'), true)
  assert.equal(isAllowedProcurementRequest('PATCH', '/suppliers/SUP-1/qualification'), true)
  assert.equal(isAllowedProcurementRequest('DELETE', '/cards/42'), false)
  assert.equal(isAllowedProcurementRequest('POST', '/cards/42/approve-rfq'), false)
})

test('gateway allow-lists the paged stage board', () => {
  assert.equal(isReadableProcurementPath('/overview/board'), true)
  assert.equal(isAllowedProcurementRequest('GET', '/overview/board'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/overview/board'), false)
  assert.equal(isReadableProcurementPath('/overview/board/raw'), false)
})

test('gateway allow-lists the bulk card import lifecycle', () => {
  assert.equal(isReadableProcurementPath('/card-imports'), true)
  assert.equal(isReadableProcurementPath('/card-imports/IMP-A1B2C3D4E5'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/card-imports'), true)
  assert.equal(isAllowedProcurementRequest('PATCH', '/card-imports/IMP-1/mapping'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/card-imports/IMP-1/confirm'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/card-imports/IMP-1/normalize'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/card-imports/IMP-1/cancel'), true)
  // Not exposed: the gateway must not invent an import endpoint.
  assert.equal(isAllowedProcurementRequest('POST', '/card-imports/IMP-1/delete'), false)
  assert.equal(isAllowedProcurementRequest('DELETE', '/card-imports/IMP-1'), false)
  assert.equal(isAllowedProcurementRequest('PATCH', '/card-imports/IMP-1'), false)
  assert.equal(isReadableProcurementPath('/card-imports/IMP-1/rows/1/raw'), false)
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
