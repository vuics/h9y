import test from 'node:test'
import assert from 'node:assert/strict'

import { echemiOperationIsError, echemiOperationLabel, initialEchemiDelivery } from './echemi.js'

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
