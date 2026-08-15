import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_TIMEOUT_MS, compactParams, timeoutFor } from './httpRules.js'

test('slow backend operations keep their long timeouts', () => {
  assert.equal(timeoutFor('/negotiations/NEG-1/responses'), 180000)
  assert.equal(timeoutFor('/cards/1/sourcing/runs'), 180000)
  assert.equal(timeoutFor('/sourcing/RUN-1'), 180000)
  assert.equal(timeoutFor('/card-imports'), 120000)
  assert.equal(timeoutFor('/card-imports/IMP-1/confirm'), 120000)
  assert.equal(timeoutFor('/cards/1/echemi/search'), 90000)
  assert.equal(timeoutFor('/negotiations/NEG-1/web-form/preview'), 90000)
})

test('ordinary reads use the short default timeout', () => {
  assert.equal(timeoutFor('/cards'), DEFAULT_TIMEOUT_MS)
  assert.equal(timeoutFor('/suppliers/SUP-1'), DEFAULT_TIMEOUT_MS)
  assert.equal(timeoutFor('/escalations'), DEFAULT_TIMEOUT_MS)
})

test('the first matching rule wins for a path that could match two', () => {
  // A card import that also normalizes must not fall through to a shorter
  // timeout just because a later rule mentions a different segment.
  assert.equal(timeoutFor('/card-imports/IMP-1/normalize'), 120000)
})

test('empty and null filters are dropped, falsy-but-real values are kept', () => {
  assert.deepEqual(
    compactParams({ search: '', status: null, page: 1, archived: false, cardId: 0 }),
    { page: 1, archived: false, cardId: 0 },
  )
})
