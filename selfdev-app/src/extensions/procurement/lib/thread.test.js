import test from 'node:test'
import assert from 'node:assert/strict'

import {
  channelLabel, contactWarning, highlightSegments, isLongText, relativeTime,
  selectableContacts, silenceSince, textPreview, threadSide,
} from './thread.js'

const text = 'Price is USD 415.00 per kg, MOQ 25 kg.'

test('highlighting marks exactly the ranges the extractor recorded', () => {
  const segments = highlightSegments(text, [
    { start: 9, end: 19, field: 'price' },
    { start: 32, end: 37, field: 'moq' },
  ])

  assert.deepEqual(segments.map(item => item.text).join(''), text)
  assert.deepEqual(
    segments.filter(item => item.span).map(item => item.text),
    ['USD 415.00', '25 kg'],
  )
})

test('a range outside the text is skipped rather than painted somewhere else', () => {
  const segments = highlightSegments('short', [{ start: 2, end: 99, field: 'price' }])

  assert.deepEqual(segments, [{ text: 'short', span: null }])
})

test('overlapping ranges never double-render the sentence', () => {
  const segments = highlightSegments(text, [
    { start: 9, end: 19, field: 'price' },
    { start: 13, end: 19, field: 'currency' },
  ])

  assert.equal(segments.map(item => item.text).join(''), text)
  assert.equal(segments.filter(item => item.span).length, 1)
})

test('only contacts the directory can actually deliver to are offered', () => {
  const contacts = [
    { contactId: 'C1', channel: 'email', usable: true, workerDispatch: true },
    {
      contactId: 'C2', channel: 'xmpp', usable: false, active: true,
      verificationStatus: 'UNVERIFIED',
    },
  ]

  assert.deepEqual(selectableContacts(contacts).map(item => item.contactId), ['C1'])
  assert.match(contactWarning(contacts[1]), /подтверждён/)
  assert.equal(contactWarning(contacts[0]), null)
})

test('a site form says it is not the worker that sends it', () => {
  assert.match(
    contactWarning({ channel: 'web_form', active: true, usable: true, workerDispatch: false }),
    /браузерном контуре/,
  )
})

test('a four-thousand character RFQ is folded, a two-line reply is not', () => {
  const rfq = 'line\n'.repeat(400)

  assert.equal(isLongText(rfq), true)
  assert.equal(isLongText('Hello,\nwe confirm.'), false)
  assert.equal(textPreview(rfq).split('\n').length, 8)
})

test('the supplier is on the left, we are on the right, the machine is between', () => {
  assert.equal(threadSide({ kind: 'message', message: { kind: 'supplier' } }), 'in')
  assert.equal(threadSide({ kind: 'message', message: { kind: 'system_outbound' } }), 'out')
  assert.equal(threadSide({ kind: 'composition' }), 'out')
  assert.equal(threadSide({ kind: 'status' }), 'system')
})

test('scheduled moments read as a distance, in both directions', () => {
  const now = Date.parse('2026-09-04T12:00:00Z')

  assert.equal(relativeTime('2026-09-04T15:00:00Z', now), 'через 3 ч')
  assert.equal(relativeTime('2026-09-04T11:30:00Z', now), '30 мин назад')
  assert.equal(relativeTime('not a date', now), null)
})

test('silence is counted from the supplier, not from our own last message', () => {
  const now = Date.parse('2026-09-04T12:00:00Z')
  const negotiation = {
    lastDispatchAt: '2026-09-03T12:00:00Z',
    messages: [
      { kind: 'supplier', createdAt: '2026-08-15T12:00:00Z' },
      { kind: 'system_outbound', createdAt: '2026-09-03T12:00:00Z' },
    ],
  }

  assert.equal(silenceSince(negotiation, now), 20)
  assert.equal(silenceSince({ messages: [] }, now), null)
})

test('channels are named as the specialist knows them', () => {
  assert.equal(channelLabel('whatsapp'), 'WhatsApp')
  assert.equal(channelLabel('web_form'), 'Веб-форма')
  assert.equal(channelLabel(undefined), 'Канал не указан')
})
