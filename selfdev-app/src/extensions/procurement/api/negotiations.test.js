import test from 'node:test'
import assert from 'node:assert/strict'

import {
  followUpNegotiationStatuses,
  isUsableNegotiationContact,
  negotiationNextActionLabel,
  isQueueableNegotiationStatus,
  toApiDateTime,
} from './negotiations.js'

test('contact eligibility applies the domain channel verification boundary', () => {
  assert.equal(isUsableNegotiationContact({ active: true, channel: 'email', verificationStatus: 'UNVERIFIED' }), true)
  assert.equal(isUsableNegotiationContact({ active: true, channel: 'xmpp', verificationStatus: 'UNVERIFIED' }), false)
  assert.equal(isUsableNegotiationContact({ active: true, channel: 'xmpp', verificationStatus: 'VERIFIED' }), true)
  assert.equal(isUsableNegotiationContact({ active: false, channel: 'email', verificationStatus: 'VERIFIED' }), false)
})

test('queue and follow-up controls reflect safe workflow states', () => {
  assert.equal(isQueueableNegotiationStatus('READY'), true)
  assert.equal(isQueueableNegotiationStatus('COMPLETE'), false)
  // ACTIVE is the status a conversation takes the moment any supplier message
  // is recorded — including a quotation entered by hand. Blocking it here made
  // the queue button unusable for every such assignment.
  assert.equal(isQueueableNegotiationStatus('ACTIVE'), true)
  assert.equal(isQueueableNegotiationStatus('ESCALATED'), false)
  assert.equal(isQueueableNegotiationStatus(undefined), false)
  assert.equal(followUpNegotiationStatuses.has('READY'), false)
  assert.equal(followUpNegotiationStatuses.has('WAITING_SUPPLIER'), true)
  assert.equal(negotiationNextActionLabel('SEND_INITIAL_RFQ'), 'Отправка согласованного RFQ')
})

test('local schedule values are converted to an API timestamp only when present', () => {
  assert.equal(toApiDateTime(''), null)
  assert.match(toApiDateTime('2030-01-03T10:00'), /^2030-01-03T/)
})
