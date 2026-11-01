import test from 'node:test'
import assert from 'node:assert/strict'

import { memberStep, memberStepCounts, memberWaitsOnStep, stepOfFilter, stepsBeyondReach, webOfferRows } from './memberSteps.js'

test('a position stands on the step its stage has reached', () => {
  assert.equal(memberStep({ stage: 'QUEUED' }), 'search')
  assert.equal(memberStep({ stage: 'SOURCING' }), 'search')
  assert.equal(memberStep({ stage: 'AWAITING_REVIEW' }), 'companies')
  assert.equal(memberStep({ stage: 'AWAITING_REVIEW', rfqAwaitingApproval: true }), 'rfq')
  assert.equal(memberStep({ stage: 'OUTREACH' }), 'send')
  assert.equal(memberStep({ stage: 'NEGOTIATION', requestCount: 2 }), 'replies')
  assert.equal(memberStep({ stage: 'DONE', requestCount: 2 }), 'replies')
})

test('the furthest step wins, so a repeated search does not send a position back', () => {
  assert.equal(memberStep({ stage: 'SOURCING', responseCount: 1 }), 'replies')
  assert.equal(memberStep({ stage: 'AWAITING_REVIEW', responseCount: 1 }), 'replies')
  assert.equal(memberStep({ stage: 'SOURCING', webPriceCount: 3 }), 'result')
})

test('any price counts: an offer, a price with no unit, a price on a site', () => {
  assert.equal(memberStep({ stage: 'NEGOTIATION' }, { priced: 1 }), 'result')
  assert.equal(memberStep({ stage: 'NEGOTIATION' }, { offers: [{ price: '1630', currency: 'RMB' }], priced: 0 }), 'result')
  assert.equal(memberStep({ stage: 'NEGOTIATION', requestCount: 1 }, { offers: [{ price: null }], priced: 0 }), 'replies')
  assert.equal(memberStep({ stage: 'DONE', webPriceCount: 1 }), 'result')
})

test('a failure and an exclusion stand off the way', () => {
  assert.equal(memberStep({ stage: 'FAILED', webPriceCount: 3 }), 'failed')
  assert.equal(memberStep({ stage: 'SOURCING', errorCode: 'X' }), 'failed')
  assert.equal(memberStep({ stage: 'SKIPPED' }), 'skipped')
})

test('finished with nothing sent stands where the purchase was set to stop', () => {
  assert.equal(memberStep({ stage: 'DONE' }, {}, { reach: 'SOURCING' }), 'search')
  assert.equal(memberStep({ stage: 'DONE' }, {}, { reach: 'CONTACTS' }), 'companies')
  assert.deepEqual([...stepsBeyondReach({ reach: 'CONTACTS' })], ['rfq', 'send', 'replies', 'result'])
  assert.deepEqual([...stepsBeyondReach({ reach: 'OUTREACH' })], [])
})

test('the counts add up to the list and say what waits for a person', () => {
  const members = [
    { cardId: 1, stage: 'SOURCING' },
    { cardId: 2, stage: 'AWAITING_REVIEW' },
    { cardId: 3, stage: 'AWAITING_REVIEW', rfqAwaitingApproval: true },
    { cardId: 4, stage: 'NEGOTIATION', requestCount: 1 },
    { cardId: 5, stage: 'NEGOTIATION', requestCount: 1 },
    { cardId: 6, stage: 'FAILED' },
  ]
  const counts = memberStepCounts(members, new Map([[5, { priced: 1 }]]))
  assert.deepEqual(counts.search, { count: 1, waiting: 0 })
  assert.deepEqual(counts.companies, { count: 1, waiting: 1 })
  assert.deepEqual(counts.rfq, { count: 1, waiting: 1 })
  assert.equal(counts.replies.count, 1)
  assert.equal(counts.result.count, 1)
  assert.equal(counts.failed.count, 1)
  assert.equal(Object.values(counts).reduce((sum, step) => sum + step.count, 0), members.length)
  assert.equal(memberWaitsOnStep({ stage: 'SOURCING' }), false)
})

test('the filter reads the step back', () => {
  assert.equal(stepOfFilter('step:rfq'), 'rfq')
  assert.equal(stepOfFilter('all'), null)
})

test('site prices read cheapest per unit first, a price with no pack after them', () => {
  const rows = webOfferRows({ candidates: [
    { id: 'A', name: 'Дорогой', webOffers: [{ id: '1', amount: 500, unitPrice: 50 }] },
    { id: 'B', name: 'Без фасовки', webOffers: [{ id: '2', amount: 10, unitPrice: null }] },
    { id: 'C', name: 'Дешёвый', webOffers: [{ id: '3', amount: 900, unitPrice: 9 }] },
    { id: 'D', name: 'Без цен' },
  ] })
  assert.deepEqual(rows.map(row => row.seller), ['Дешёвый', 'Дорогой', 'Без фасовки'])
  assert.deepEqual(webOfferRows(null), [])
})
