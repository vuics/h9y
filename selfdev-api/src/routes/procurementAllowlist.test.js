import test from 'node:test'
import assert from 'node:assert/strict'

import {
  compilePathTemplate,
  isAllowedProcurementRequest,
  isReadableProcurementPath,
} from './procurement.js'
import { PROCUREMENT_ENDPOINTS } from './procurementEndpoints.js'
import { GATEWAY_DENIED, isDenied } from './procurementGatewayPolicy.js'

const concrete = path => path.replace(/\{[^}]+\}/g, 'X')

test('every generated endpoint is reachable unless the gateway policy denies it', () => {
  const unreachable = PROCUREMENT_ENDPOINTS
    .filter(endpoint => !isDenied(endpoint.method, endpoint.path))
    .filter(endpoint => !isAllowedProcurementRequest(endpoint.method, concrete(endpoint.path)))
    .map(endpoint => `${endpoint.method} ${endpoint.path}`)

  assert.deepEqual(unreachable, [])
})

test('a denied endpoint stays blocked even though the API exposes it', () => {
  for (const entry of GATEWAY_DENIED) {
    assert.equal(
      isAllowedProcurementRequest(entry.method, concrete(entry.path)), false,
      `${entry.method} ${entry.path} must be denied`,
    )
  }
})

test('the deny list only names endpoints that actually exist upstream', () => {
  // A rule that matches nothing is a rule that stopped protecting anything.
  const stale = GATEWAY_DENIED.filter(entry => !PROCUREMENT_ENDPOINTS.some(
    endpoint => endpoint.method === entry.method && endpoint.path === entry.path,
  ))
  assert.deepEqual(stale.map(entry => `${entry.method} ${entry.path}`), [])
})

test('a path parameter matches exactly one segment', () => {
  const pattern = compilePathTemplate('/cards/{card_id}/rfq')
  assert.equal(pattern.test('/cards/42/rfq'), true)
  // Without a per-segment bound, a parameter could walk into another endpoint.
  assert.equal(pattern.test('/cards/42/echemi/rfq'), false)
  assert.equal(pattern.test('/cards//rfq'), false)
})

test('literal segments are escaped rather than treated as a pattern', () => {
  const pattern = compilePathTemplate('/proposals/export')
  assert.equal(pattern.test('/proposals/export'), true)
  assert.equal(pattern.test('/proposals/exXort'), false)
})

test('a template is anchored at both ends', () => {
  const pattern = compilePathTemplate('/cards')
  assert.equal(pattern.test('/cards'), true)
  assert.equal(pattern.test('/cards/42'), false)
  assert.equal(pattern.test('/v1/cards'), false)
})

test('unknown paths and methods are refused', () => {
  assert.equal(isReadableProcurementPath('/admin/raw-collections'), false)
  assert.equal(isReadableProcurementPath('/cards/1042/delete'), false)
  assert.equal(isAllowedProcurementRequest('DELETE', '/cards/42'), false)
  assert.equal(isAllowedProcurementRequest('HEAD', '/cards'), false)
  assert.equal(isAllowedProcurementRequest('OPTIONS', '/cards'), false)
})

test('a read-only path cannot be written to', () => {
  assert.equal(isAllowedProcurementRequest('GET', '/activity'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/activity'), false)
  assert.equal(isAllowedProcurementRequest('GET', '/proposals/export'), true)
  assert.equal(isAllowedProcurementRequest('POST', '/proposals/export'), false)
})

test('endpoints added since the hand-written list are now reachable', () => {
  // Each of these shipped in the API while the gateway still refused it.
  for (const [method, path] of [
    ['POST', '/card-imports'],
    ['PATCH', '/card-imports/IMP-1/mapping'],
    ['POST', '/card-imports/IMP-1/confirm'],
    ['PATCH', '/cards/42/rfq'],
    ['PATCH', '/suppliers/SUP-1'],
    ['POST', '/negotiations/NEG-1/web-form/prepare'],
    ['POST', '/sourcing/RUN-1/cancel'],
    ['POST', '/sourcing/RUN-1/sources/SRC-1/retry'],
    ['PUT', '/sourcing/query-templates'],
    ['GET', '/overview/board'],
    ['GET', '/web-form/adapters'],
  ]) {
    assert.equal(isAllowedProcurementRequest(method, path), true, `${method} ${path}`)
  }
})
