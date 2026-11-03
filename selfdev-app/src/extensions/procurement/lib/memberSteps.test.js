import test from 'node:test'
import assert from 'node:assert/strict'

import { memberStep, memberStepCounts, stepSquares, memberWaitsOnStep, priceStrip, stepOfFilter, stepsBeyondReach, unpricedSellers, webOfferRows, webPriceLine, webPriceSummary } from './memberSteps.js'

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
  assert.deepEqual(counts.search, { count: 1, waiting: 0, again: 0 })
  assert.deepEqual(counts.companies, { count: 1, waiting: 1, again: 0 })
  assert.deepEqual(counts.rfq, { count: 1, waiting: 1, again: 0 })
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
    { id: 'E', name: 'Агромагазин', reviewDecision: 'REJECTED', webOffers: [{ id: '4', amount: 3575, unitPrice: 1 }] },
  ] })
  assert.deepEqual(rows.map(row => row.seller), ['Дешёвый', 'Дорогой', 'Без фасовки'])
  assert.deepEqual(webOfferRows(null), [])
})

test('the row says how many sellers publish a price, and what prices', () => {
  assert.equal(webPriceLine({}), null)
  assert.equal(webPriceLine({ webPriceCount: 1 }), 'На сайтах: 1 продавец')
  assert.equal(
    webPriceLine({ webPriceCount: 19, webPrices: { currency: 'RUB', unit: 'мл', min: 2.72, max: 116, median: 13 } }),
    'На сайтах: 19 продавцов · 2,72–116 ₽/мл · медиана 13 ₽/мл',
  )
  assert.equal(
    webPriceLine({ webPriceCount: 2, webPrices: { currency: 'RUB', unit: null, min: 210, max: 11700, median: null } }),
    'На сайтах: 2 продавца · 210–11\u00a0700 ₽',
  )
  assert.equal(
    webPriceLine({ webPriceCount: 1, webPrices: { currency: 'RUB', unit: 'мл', min: 96.67, max: 96.67, median: null } }),
    'На сайтах: 1 продавец · 96,67 ₽/мл',
  )
})

test('the section header says the prices alone: its title holds the count', () => {
  assert.equal(webPriceSummary({ webPriceCount: 1 }), null)
  assert.equal(
    webPriceSummary({ webPriceCount: 19, webPrices: { currency: 'RUB', unit: 'мл', min: 2.72, max: 116, median: 13 } }),
    '2,72–116 ₽/мл · медиана 13 ₽/мл',
  )
})

test('the strip places the commonest unit on a log scale, when there is a spread', () => {
  const row = (unitPrice, unit = 'мл', currency = 'RUB') => ({ unitPrice, unit, currency })
  const strip = priceStrip([row(1), row(10), row(100), row(5, 'г'), { unitPrice: null }])
  assert.equal(strip.unit, 'мл')
  assert.deepEqual(strip.points.map(point => Math.round(point.at)), [0, 50, 100])
  assert.equal(strip.median, 10)
  assert.equal(Math.round(strip.medianAt), 50)
  assert.equal(priceStrip([row(1), row(2)]), null)
  assert.equal(priceStrip([row(3), row(3), row(3)]), null)
  assert.equal(priceStrip([]), null)
})

test('a position searched again keeps its step and is counted on the search step too', () => {
  const counts = memberStepCounts([
    { cardId: 1, stage: 'NEGOTIATION', requestCount: 3, responseCount: 1, stepProgress: { research: true } },
    { cardId: 2, stage: 'NEGOTIATION', requestCount: 3, responseCount: 1 },
  ])
  assert.deepEqual(counts.replies, { count: 2, waiting: 0, again: 1 })
  assert.deepEqual(counts.search, { count: 0, waiting: 0, again: 1 })
})

test('a step draws a square per position, and a number past the limit', () => {
  assert.deepEqual(stepSquares({ count: 3, waiting: 1, again: 1 }).kinds, ['waiting', 'plain', 'again'])
  // Waiting and searched again at once is still one position.
  assert.deepEqual(stepSquares({ count: 2, waiting: 2, again: 1 }).kinds, ['waiting', 'again'])
  const many = stepSquares({ count: 40, waiting: 0, again: 0 }, 18)
  assert.equal(many.kinds.length, 17)
  assert.equal(many.more, 23)
})

test('sellers with packs and no price are one line each, not a row a pack', () => {
  const rows = [
    { candidateId: 'R', seller: 'Реарус', amount: null, availability: 'ON_ORDER', url: 'https://rearus.ru/1' },
    { candidateId: 'R', seller: 'Реарус', amount: null, availability: 'ON_ORDER' },
    { candidateId: 'M', seller: 'Молекулаб', amount: 1344.9, availability: 'ON_ORDER' },
    { candidateId: 'G', seller: 'Гермеон', amount: null, availability: 'UNKNOWN' },
  ]
  assert.deepEqual(unpricedSellers(rows), [
    { seller: 'Реарус', candidateId: 'R', url: 'https://rearus.ru/1', packs: 2, availability: 'ON_ORDER' },
    { seller: 'Гермеон', candidateId: 'G', url: undefined, packs: 1, availability: null },
  ])
})
