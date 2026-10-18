import test from 'node:test'
import assert from 'node:assert/strict'

import { reviewOpen, reviewSummary, verdictKey } from './campaignReview.js'

const candidate = (decision = 'UNREVIEWED') => ({ candidateId: 'C', reviewDecision: decision })
const item = extra => ({ cardId: 1, candidates: [], rfq: null, normalization: null, blockedBy: null, ...extra })

test('a decision is a company under one substance', () => {
  assert.notEqual(verdictKey(1, 'C'), verdictKey(2, 'C'))
})

test('a substance asks for a person while anything in it is undecided', () => {
  assert.equal(reviewOpen(item({ candidates: [candidate()] })), true)
  assert.equal(reviewOpen(item({ rfq: { status: 'PREPARED' } })), true)
  assert.equal(reviewOpen(item({ normalization: { reasons: [] } })), true)
  assert.equal(reviewOpen(item({ candidates: [candidate('REJECTED')], rfq: { status: 'APPROVED' } })), false)
  assert.equal(reviewOpen(item({ candidates: [candidate()], blockedBy: 'STAGE_SOURCING' })), false)
  assert.equal(reviewOpen(undefined), false)
})

test('the folded line says what is open and where the RFQ stands', () => {
  assert.equal(reviewSummary(item({ candidates: [candidate(), candidate(), candidate('REJECTED')], rfq: { status: 'PREPARED' } })), '2 на решении · RFQ подготовлен, не согласован')
  assert.equal(reviewSummary(item({ candidates: [candidate('REJECTED')], rfq: { status: 'APPROVED' } })), 'кандидаты решены · RFQ согласован')
  assert.equal(reviewSummary(item({ blockedBy: 'STAGE_SOURCING' })), 'поиск ещё идёт')
  assert.equal(reviewSummary(item({})), 'нечего согласовывать')
})
