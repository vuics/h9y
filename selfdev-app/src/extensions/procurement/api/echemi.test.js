import test from 'node:test'
import assert from 'node:assert/strict'

import { echemiOperationIsError, echemiOperationLabel, echemiReadiness, initialEchemiDelivery } from './echemi.js'

test('normalized cards may search before RFQ approval, but inquiry preparation may not', () => {
  assert.deepEqual(echemiReadiness('NORMALIZED', 'AWAITING_APPROVAL'), {
    searchReady: true, inquiryReady: false,
  })
  assert.deepEqual(echemiReadiness('NORMALIZED', 'APPROVED'), {
    searchReady: true, inquiryReady: true,
  })
  assert.deepEqual(echemiReadiness('NEW', 'APPROVED'), {
    searchReady: false, inquiryReady: false,
  })
})

test('Echemi form defaults only parse an explicit supported card quantity', () => {
  assert.deepEqual(initialEchemiDelivery('21 кг'), {
    quantity: '', unit: 'KG', shipmentTerm: 'CIP', destination: '', country: 'RU',
  })
  assert.deepEqual(initialEchemiDelivery('21.5 KG'), {
    quantity: '21.5', unit: 'KG', shipmentTerm: 'CIP', destination: '', country: 'RU',
  })
})

test('human verification is a recoverable handoff while disabled submission is an error', () => {
  assert.equal(echemiOperationIsError({ code: 'HUMAN_ACTION_REQUIRED' }), false)
  assert.match(echemiOperationLabel({ code: 'HUMAN_ACTION_REQUIRED' }), /ручную проверку/)
  assert.equal(echemiOperationIsError({ code: 'ECHEMI_SUBMISSION_DISABLED' }), true)
  assert.match(echemiOperationLabel({ code: 'ECHEMI_SUBMISSION_DISABLED' }), /ECHEMI_ENABLE_SUBMISSION/)
  assert.equal(echemiOperationIsError({ code: 'ECHEMI_SUBMISSION_NEEDS_REVIEW' }), true)
})
