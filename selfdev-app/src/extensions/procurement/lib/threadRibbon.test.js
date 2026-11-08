import test from 'node:test'
import assert from 'node:assert/strict'

import { longestSilence, markHref, markType, silence, spanLabel, threadRibbon, upcomingMark } from './threadRibbon.js'

const DAY = 24 * 60 * 60 * 1000
const START = Date.parse('2026-10-12T09:00:00Z')
const at = days => new Date(START + days * DAY).toISOString()

const out = (id, days, extra = {}) => ({ kind: 'message', id, at: at(days), direction: 'OUTBOUND', ...extra })
const inbound = (id, days, extra = {}) => ({ kind: 'message', id, at: at(days), direction: 'INBOUND', ...extra })
const escalation = (id, days, resolved) => ({ kind: 'escalation', id, at: at(days), resolved, title: 'Цена выше ориентира' })

const thread = (events, extra = {}) => ({
  assignmentId: 'NEG-1', supplierName: 'CHEM EXPRESS', status: 'WAITING_SUPPLIER', events, eventTotal: events.length, ...extra,
})

test('each event is drawn as what it was to the person reading', () => {
  assert.equal(markType(out('a', 0)), 'out')
  assert.equal(markType(out('a', 0, { failed: true })), 'failed')
  assert.equal(markType(inbound('a', 0)), 'in')
  assert.equal(markType(inbound('a', 0, { automatic: true })), 'auto')
  assert.equal(markType(escalation('e', 0, false)), 'escalationOpen')
  assert.equal(markType(escalation('e', 0, true)), 'escalationResolved')
})

test('a letter leads to itself on the conversation page, a case to the case', () => {
  assert.equal(markHref(out('COMM-1', 0), 'NEG-1'), '/procurement/negotiations/NEG-1#msg-COMM-1')
  assert.equal(markHref(escalation('ESC-1', 0, false), 'NEG-1'), '/procurement/escalations/ESC-1')
})

test('a pause of a day or more is labelled, a shorter one is not', () => {
  const ribbon = threadRibbon(thread([out('a', 0), inbound('b', 0.2), out('c', 4.5)]), { now: START + 5 * DAY })

  assert.deepEqual(ribbon.items.map(item => (item.kind === 'gap' ? item.label : item.type)), ['out', 'in', '4 дн', 'out'])
})

test('older events fold into a count, including those the server did not send', () => {
  const events = Array.from({ length: 12 }, (_, index) => out(`m${index}`, index * 0.1))
  const ribbon = threadRibbon(thread(events, { eventTotal: 20 }), { visible: 7 })

  assert.equal(ribbon.hidden, 13)
  assert.equal(ribbon.items.filter(item => item.kind === 'mark').length, 7)
  assert.equal(ribbon.items[0].event.id, 'm5')
})

test('silence is counted from our last letter, and turns late after a week', () => {
  const now = START + 9 * DAY
  assert.deepEqual(
    silence(thread([out('a', 0), inbound('b', 1), out('c', 2)]), now),
    { since: at(2), days: 7, label: '7 дн', late: true },
  )
  assert.equal(silence(thread([out('a', 0), out('c', 8)]), now).late, false)
})

test('an autoreply does not end the wait, and an answer does', () => {
  const now = START + 3 * DAY
  assert.equal(silence(thread([out('a', 0), inbound('b', 1, { automatic: true })]), now).days, 3)
  assert.equal(silence(thread([out('a', 0), inbound('b', 1)]), now), null)
})

test('nobody waits on a letter that never arrived, or on a conversation that waits for us', () => {
  const now = START + 3 * DAY
  assert.equal(silence(thread([out('a', 0, { failed: true })]), now), null)
  assert.equal(silence(thread([out('a', 0)], { awaitingPerson: true }), now), null)
  assert.equal(silence(thread([out('a', 0)], { status: 'COMPLETE' }), now), null)
})

test('what comes next: a prepared letter, a form to fill, or a planned reminder', () => {
  assert.equal(upcomingMark({ waitingFor: 'SEND', status: 'READY' }).type, 'draft')
  assert.equal(upcomingMark({ waitingFor: 'WEB_FORM', status: 'QUEUED' }).type, 'webForm')
  const planned = upcomingMark({ status: 'QUEUED', nextAction: 'FOLLOW_UP', nextActionAt: at(3) })
  assert.equal(planned.type, 'planned')
  assert.match(planned.title, /^Напоминание поставщику · /)
  assert.equal(upcomingMark({ status: 'WAITING_SUPPLIER', nextActionAt: at(3) }), null)
  assert.equal(upcomingMark({ status: 'QUEUED', nextActionAt: at(3), automationPaused: true }), null)
})

test('the header names the supplier silent longest', () => {
  const now = START + 9 * DAY
  const longest = longestSilence([
    thread([out('a', 7)], { supplierName: 'Acros' }),
    thread([out('a', 0)], { supplierName: 'Реарус' }),
    thread([out('a', 0), inbound('b', 1)], { supplierName: 'neofroxx' }),
  ], now)
  assert.equal(longest.supplierName, 'Реарус')
  assert.equal(longest.days, 9)
  assert.equal(longestSilence([thread([out('a', 8.9)])], now), null)
})

test('spans read as briefly as a line allows', () => {
  assert.equal(spanLabel(10 * 60 * 1000), '<1 ч')
  assert.equal(spanLabel(5 * 60 * 60 * 1000), '5 ч')
  assert.equal(spanLabel(3.7 * DAY), '3 дн')
})
