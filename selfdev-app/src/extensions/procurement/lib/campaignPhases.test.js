import test from 'node:test'
import assert from 'node:assert/strict'

import { memberPhases, phaseSummary } from './campaignPhases.js'

test('a campaign in negotiation reads as moving, not as 0 of 28', () => {
  const members = [
    { cardId: 1, stage: 'NEGOTIATION', responseCount: 2 },
    { cardId: 2, stage: 'NEGOTIATION', responseCount: 0 },
    { cardId: 3, stage: 'NEGOTIATION', responseCount: 0 },
    { cardId: 4, stage: 'AWAITING_REVIEW' },
    { cardId: 5, stage: 'SOURCING' },
  ]
  // #3 was answered only on the marketplace, #1 has a price.
  const offers = new Map([[1, { offers: [{}, {}], priced: 1 }], [3, { offers: [{}], priced: 0 }]])
  const counts = memberPhases(members, offers)
  assert.equal(counts.priced, 1)
  assert.equal(counts.answered, 1)
  assert.equal(counts.waiting, 1)
  assert.equal(counts.review, 1)
  assert.equal(counts.searching, 1)
  assert.equal(phaseSummary(counts, 2), '1 с ценой · 1 с ответами')
})
