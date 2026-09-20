import test from 'node:test'
import assert from 'node:assert/strict'

import { filterCounts, foundSummary, memberGroup, needsMarketplaceAction, nextActions, offerTotals, requestsSummary } from './campaignView.js'

const member = (extra = {}) => ({ cardId: 7, stage: 'SOURCING', ...extra })

test('a substance belongs to the chip that says who is holding it', () => {
  assert.equal(memberGroup(member()), 'working')
  assert.equal(memberGroup(member({ stage: 'AWAITING_REVIEW', waitingFor: 'CANDIDATE_REVIEW' })), 'waiting')
  assert.equal(memberGroup(member({ stage: 'NEGOTIATION', marketplaceStatus: 'NEEDS_REVIEW' })), 'waiting')
  assert.equal(memberGroup(member({ stage: 'DONE' })), 'done')
  assert.equal(memberGroup(member({ stage: 'FAILED', errorCode: 'CARD_NOT_NORMALIZED' })), 'failed')
  assert.deepEqual(filterCounts([member(), member({ stage: 'DONE' })]), {
    all: 2, waiting: 0, working: 1, done: 1, failed: 0,
  })
})

test('a row offers its own decision first and the marketplace check after', () => {
  assert.deepEqual(nextActions(member({ waitingFor: 'CANDIDATE_REVIEW' }), 'CMP-1').map(item => item.label), ['Согласовать'])
  assert.equal(nextActions(member({ waitingFor: 'RFQ_APPROVAL' }), 'CMP-1')[0].to, '/procurement/requests/7/rfq')
  // Both: the card failed and the platform never confirmed its request.
  assert.deepEqual(
    nextActions(member({ errorCode: 'CARD_NOT_NORMALIZED', marketplaceStatus: 'NEEDS_REVIEW' }), 'CMP-1')
      .map(item => [item.label, item.tone]),
    [['Открыть карточку', 'danger'], ['Закончить заявку', 'muted']],
  )
  assert.deepEqual(nextActions(member(), 'CMP-1'), [])
  assert.equal(needsMarketplaceAction(member({ marketplaceStatus: 'STALE' })), true)
  assert.equal(needsMarketplaceAction(member({ marketplaceStatus: 'SUBMITTED' })), false)
})

test('the numbers read as one cell each', () => {
  assert.equal(foundSummary(member({ candidateCount: 9, contactCount: 7, verifiedCount: 1 })), '9 · 7 · 1')
  assert.equal(foundSummary(member()), '—')
  assert.equal(requestsSummary(member({ requestCount: 6, responseCount: 2 })), '6 → 2')
  assert.equal(requestsSummary(member({ requestCount: 6 })), '6')
  assert.equal(requestsSummary(member()), '—')
})

test('offers are counted from the offers, not from answers to letters', () => {
  const groups = new Map([
    [1, { offers: [{}, {}], priced: 1 }],
    [2, { offers: [{}], priced: 0 }],
  ])
  assert.deepEqual(offerTotals(groups), { offers: 3, priced: 1 })
  assert.deepEqual(offerTotals(new Map()), { offers: 0, priced: 0 })
})
