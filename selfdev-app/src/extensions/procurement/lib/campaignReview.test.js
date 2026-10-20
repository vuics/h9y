import test from 'node:test'
import assert from 'node:assert/strict'

import { reviewBadges, reviewOpen, suggestedVerdict, verdictKey } from './campaignReview.js'

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

const labels = value => reviewBadges(value).map(badge => `${badge.tone}:${badge.label}`)

test('the folded header says what was approved, coloured by who acts', () => {
  assert.deepEqual(labels(item({ candidates: [candidate(), candidate(), candidate('VERIFIED_MANUFACTURER')], rfq: { status: 'PREPARED', documentFingerprint: 'f' } })),
    ['warning:2 на решении', 'complete:компаний подтверждено: 1', 'warning:RFQ ждёт согласования'])
  // Past the approval the stage is not repeated: what was approved is.
  assert.deepEqual(labels(item({ blockedBy: 'STAGE_NEGOTIATION', candidates: [candidate('PRICE_REQUEST'), candidate('REJECTED')], rfq: { status: 'APPROVED' } })),
    ['complete:компаний подтверждено: 1', 'complete:RFQ согласован'])
  assert.deepEqual(labels(item({ blockedBy: 'STAGE_SOURCING' })), ['muted:поиск ещё идёт'])
  assert.deepEqual(labels(item({ normalization: { reasons: [] }, rfq: { status: 'NOT_PREPARED' } })), ['danger:идентичность не подтверждена', 'muted:RFQ не подготовлен'])
  assert.deepEqual(labels(item({})), ['muted:нечего согласовывать'])
})

test('a company starts on its concluded role, else a price request, else evidence', () => {
  assert.deepEqual(suggestedVerdict({ role: 'MANUFACTURER', contactCount: 0 }), { value: 'VERIFIED_MANUFACTURER', reason: 'рекомендую' })
  assert.deepEqual(suggestedVerdict({ role: 'DISTRIBUTOR', contactCount: 2 }), { value: 'VERIFIED_DISTRIBUTOR', reason: 'рекомендую' })
  assert.deepEqual(suggestedVerdict({ role: 'UNKNOWN', contactCount: 2, preliminaryStatus: 'YELLOW' }), { value: 'PRICE_REQUEST', reason: 'есть контакт' })
  assert.deepEqual(suggestedVerdict({ role: 'UNKNOWN', contactCount: 0 }), { value: 'NEEDS_MORE_EVIDENCE', reason: 'нет данных' })
  // High risk is a person's call even with someone to write to.
  assert.deepEqual(suggestedVerdict({ role: 'UNKNOWN', contactCount: 3, preliminaryStatus: 'RED' }), { value: 'NEEDS_MORE_EVIDENCE', reason: 'нет данных' })
})
