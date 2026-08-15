import test from 'node:test'
import assert from 'node:assert/strict'

import { RFQ_VERSIONS, rfqVersionText } from './rfqVersions.js'

test('all four versions are offered, short ones first', () => {
  assert.deepEqual(RFQ_VERSIONS.map(([value]) => value),
    ['english_short', 'russian_short', 'english', 'russian'])
})

test('a version is read from either naming convention', () => {
  assert.equal(rfqVersionText({ englishShort: 'Hello.' }, 'english_short'), 'Hello.')
  assert.equal(rfqVersionText({ english_short: 'Hello.' }, 'english_short'), 'Hello.')
  assert.equal(rfqVersionText({ rfq: { russian: 'Здравствуйте.' } }, 'russian'), 'Здравствуйте.')
})

test('a version carried as an object yields its message body', () => {
  assert.equal(rfqVersionText({ english: { emailText: 'Body.' } }, 'english'), 'Body.')
  assert.equal(rfqVersionText({ english: { email_text: 'Body.' } }, 'english'), 'Body.')
})

test('a version the card has not got yet reads as empty, never as undefined', () => {
  assert.equal(rfqVersionText({ english: 'Hi.' }, 'russian_short'), '')
  assert.equal(rfqVersionText({ english: '   ' }, 'english'), '')
  assert.equal(rfqVersionText(null, 'english'), '')
})
