import test from 'node:test'
import assert from 'node:assert/strict'

import { canResendAfterChannel, channelChoices, endedNote, liveCount, menuActions, primaryAction, sendOutcome } from './threadActions.js'

const thread = extra => ({ assignmentId: 'NEG-1', status: 'WAITING_SUPPLIER', events: [], ...extra })
const kinds = items => items.map(item => `${item.kind}:${item.label}`)

test('a conversation the agent is running asks nothing of anybody', () => {
  assert.equal(primaryAction(thread()), null)
})

test('each thing a conversation waits on gets its own button', () => {
  assert.deepEqual(primaryAction(thread({ status: 'READY', waitingFor: 'SEND' })), { kind: 'send', label: 'Отправить' })
  assert.equal(primaryAction(thread({ status: 'ACTIVE', automationPaused: true, waitingFor: 'PAUSED' })).kind, 'resume')
  assert.deepEqual(
    primaryAction(thread({ status: 'QUEUED', waitingFor: 'WEB_FORM' })),
    { kind: 'link', label: 'Заполнить форму', to: '/procurement/negotiations/NEG-1' },
  )
})

test('«Ответить» lands on the supplier’s last real letter, past an autoreply', () => {
  const action = primaryAction(thread({
    status: 'ACTIVE',
    waitingFor: 'REPLY',
    events: [
      { kind: 'message', id: 'C1', direction: 'INBOUND' },
      { kind: 'message', id: 'C2', direction: 'INBOUND', automatic: true },
    ],
  }))
  assert.equal(action.to, '/procurement/negotiations/NEG-1#msg-C1')
})

test('an open case decidable here comes first, even on a stopped conversation', () => {
  const action = primaryAction(
    thread({ status: 'ESCALATED', automationPaused: true, events: [{ kind: 'escalation', id: 'ESC-1', resolved: false }] }),
    { decidable: new Set(['ESC-1']) },
  )
  assert.deepEqual(action, { kind: 'decide', label: 'Решить', escalationId: 'ESC-1' })
  // A case this position cannot decide is left to its page.
  assert.equal(primaryAction(thread({ status: 'ESCALATED', events: [{ kind: 'escalation', id: 'ESC-1', resolved: false }] })), null)
})

test('an ended conversation has no button and nothing to close', () => {
  assert.equal(primaryAction(thread({ status: 'CANCELLED', waitingFor: 'SEND' })), null)
  assert.deepEqual(kinds(menuActions(thread({ status: 'COMPLETE' }))), ['link:Открыть переписку'])
})

test('the menu offers to stop a running agent, chase a silent supplier, and close', () => {
  assert.deepEqual(kinds(menuActions(thread())), [
    'pause:Остановить агента', 'remind:Напомнить сейчас', 'channel:Сменить канал…', 'link:Открыть переписку', 'close:Закрыть переписку…',
  ])
})

test('a stopped agent is resumed from the menu and sends nothing until it is', () => {
  assert.deepEqual(kinds(menuActions(thread({ automationPaused: true }))), [
    'resume:Возобновить агента', 'channel:Сменить канал…', 'link:Открыть переписку', 'close:Закрыть переписку…',
  ])
})

test('a planned first letter can be sent now, a web form cannot', () => {
  assert.ok(kinds(menuActions(thread({ status: 'QUEUED' }))).includes('remind:Отправить сейчас'))
  assert.ok(!menuActions(thread({ status: 'QUEUED', waitingFor: 'WEB_FORM' })).some(item => item.kind === 'remind'))
})

test('a closed conversation says why on its line', () => {
  assert.deepEqual(
    endedNote(thread({ status: 'CANCELLED', closeReason: 'BOUGHT_ELSEWHERE', endedBecause: 'Закрыто специалистом: …' })),
    { text: 'закрыта: купили у другого поставщика', title: 'Закрыто специалистом: …' },
  )
  assert.equal(endedNote(thread({ status: 'CANCELLED' })).text, 'закрыта')
  assert.equal(endedNote(thread()), null)
})

test('a send from the line reports what became of that one letter', () => {
  assert.equal(sendOutcome({ sent: ['NEG-1'] }, 'NEG-1').tone, 'success')
  assert.match(sendOutcome({ sent: [], skipped: [{ assignmentId: 'NEG-1', code: 'RFQ_SUPERSEDED' }] }, 'NEG-1').text, /старому RFQ/)
  assert.match(sendOutcome({ sent: [], errors: [{ assignmentId: 'NEG-1', message: 'boom' }] }, 'NEG-1').text, /boom/)
  assert.equal(sendOutcome({ sent: [] }, 'NEG-1').tone, 'warning')
})

test('«закрыть все» counts only what is still open', () => {
  assert.equal(liveCount([thread(), thread({ status: 'COMPLETE' }), thread({ status: 'READY' })]), 2)
})

test('a letter that bounced asks for another channel, not for patience', () => {
  const stuck = thread({ waitingFor: 'UNDELIVERED', awaitingPerson: true })
  assert.deepEqual(primaryAction(stuck), { kind: 'channel', label: 'Сменить канал' })
  // Offered once, as the button; the menu does not repeat it.
  assert.ok(!menuActions(stuck).some(item => item.kind === 'channel'))
})

test('the channels offered are the usable other ones, those the worker can send first', () => {
  const contacts = [
    { contactId: 'A', usable: true, workerDispatch: true },
    { contactId: 'B', usable: true, workerDispatch: false },
    { contactId: 'C', usable: false, workerDispatch: true },
    { contactId: 'D', usable: true, workerDispatch: true },
  ]
  assert.deepEqual(channelChoices(contacts, 'A').map(item => item.contactId), ['D', 'B'])
})

test('only a conversation waiting on the supplier is sent again on the new channel', () => {
  assert.equal(canResendAfterChannel(thread()), true)
  assert.equal(canResendAfterChannel(thread({ status: 'ESCALATED' })), false)
  assert.equal(canResendAfterChannel(thread({ automationPaused: true })), false)
})
