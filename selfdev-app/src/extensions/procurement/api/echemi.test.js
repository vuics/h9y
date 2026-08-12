import test from 'node:test'
import assert from 'node:assert/strict'

import { echemiOperationIsError, echemiOperationLabel, echemiReadiness, initialEchemiDelivery, quantityMatchesCard } from './echemi.js'

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

test('Echemi form starts from the card quantity the backend parsed', () => {
  // The backend understands Cyrillic units, so "21 кг" now arrives parsed.
  assert.deepEqual(initialEchemiDelivery({ parsed: true, quantity: 21, unit: 'KG' }), {
    quantity: '21', unit: 'KG', shipmentTerm: 'CIP', destination: '', country: 'RU',
  })
  // A volume the backend could not parse leaves the field empty rather than
  // inventing a number the validator would later reject.
  assert.deepEqual(initialEchemiDelivery({ parsed: false, quantity: null, unit: null }), {
    quantity: '', unit: 'KG', shipmentTerm: 'CIP', destination: '', country: 'RU',
  })
  // A unit Echemi does not offer falls back without losing the amount.
  assert.deepEqual(initialEchemiDelivery({ parsed: true, quantity: 5, unit: 'ML' }), {
    quantity: '5', unit: 'KG', shipmentTerm: 'CIP', destination: '', country: 'RU',
  })
})

test('the workspace refuses a quantity the server would reject', () => {
  const target = { parsed: true, quantity: 25, unit: 'KG', volume: '25 KG', massFactors: { MT: 1000, KG: 1, G: 0.001, MG: 0.000001 } }

  assert.equal(quantityMatchesCard(target, '25', 'KG').state, 'MATCHES')
  // The same mass in another unit is exactly what the server allows.
  const converted = quantityMatchesCard(target, '25000', 'G')
  assert.equal(converted.state, 'MATCHES')
  assert.equal(converted.converted, true)
  assert.equal(quantityMatchesCard(target, '97', 'KG').state, 'DIFFERS')
  assert.equal(quantityMatchesCard(target, '25', 'PCS').state, 'DIFFERS')
  assert.equal(quantityMatchesCard(target, '0', 'KG').state, 'INVALID')
  assert.equal(quantityMatchesCard({ parsed: false }, '25', 'KG').state, 'UNKNOWN')
})

test('human verification is a recoverable handoff while disabled submission is an error', () => {
  assert.equal(echemiOperationIsError({ code: 'HUMAN_ACTION_REQUIRED' }), false)
  assert.match(echemiOperationLabel({ code: 'HUMAN_ACTION_REQUIRED' }), /ручную проверку/)
  assert.equal(echemiOperationIsError({ code: 'ECHEMI_SUBMISSION_DISABLED' }), true)
  assert.match(echemiOperationLabel({ code: 'ECHEMI_SUBMISSION_DISABLED' }), /ECHEMI_ENABLE_SUBMISSION/)
  assert.equal(echemiOperationIsError({ code: 'ECHEMI_SUBMISSION_NEEDS_REVIEW' }), true)
})
