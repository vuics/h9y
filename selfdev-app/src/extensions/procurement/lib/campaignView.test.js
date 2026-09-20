import test from 'node:test'
import assert from 'node:assert/strict'

import { filterCounts, foundSummary, memberGroup, nextAction, requestsSummary } from './campaignView.js'

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

test('a row offers one press, and the marketplace check comes last', () => {
  assert.equal(nextAction(member({ waitingFor: 'CANDIDATE_REVIEW' }), 'CMP-1').to, '/procurement/campaigns/CMP-1/review')
  assert.equal(nextAction(member({ waitingFor: 'RFQ_APPROVAL' }), 'CMP-1').to, '/procurement/requests/7/rfq')
  // The decision about the substance outranks the marketplace check every
  // substance of the campaign is waiting on at once.
  assert.equal(
    nextAction(member({ waitingFor: 'CANDIDATE_REVIEW', marketplaceStatus: 'NEEDS_REVIEW' }), 'CMP-1').label,
    'Согласовать',
  )
  assert.equal(
    nextAction(member({ errorCode: 'CARD_NOT_NORMALIZED', marketplaceStatus: 'NEEDS_REVIEW' }), 'CMP-1').label,
    'Открыть карточку',
  )
  assert.deepEqual(
    nextAction(member({ stage: 'NEGOTIATION', marketplaceStatus: 'NEEDS_REVIEW' }), 'CMP-1'),
    { label: 'Закончить заявку', to: '/procurement/requests/7/echemi', tone: 'muted' },
  )
  assert.equal(nextAction(member(), 'CMP-1'), null)
})

test('the numbers read as one cell each', () => {
  assert.equal(foundSummary(member({ candidateCount: 9, contactCount: 7, verifiedCount: 1 })), '9 · 7 · 1')
  assert.equal(foundSummary(member()), '—')
  assert.equal(requestsSummary(member({ requestCount: 6, responseCount: 2 })), '6 → 2')
  assert.equal(requestsSummary(member({ requestCount: 6 })), '6')
  assert.equal(requestsSummary(member()), '—')
})
