import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attributionByCommunication, buildTimeline, collapseStatusRuns, conversationPulse,
  latestUnlinked, pendingDecisions, plannedAction, quotesByMessage, splitFuture,
} from './timeline.js'

const sent = {
  compositionId: 'CMP-1', status: 'SENT', communicationId: 'COMM-1',
  createdAt: '2026-08-01T10:00:00Z',
}
const held = {
  compositionId: 'CMP-2', status: 'DRAFT', communicationId: null,
  createdAt: '2026-08-01T12:00:00Z',
}

test('a delivered draft enriches its message instead of duplicating it', () => {
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-1', createdAt: '2026-08-01T10:00:05Z', text: 'RFQ' }],
    compositions: [sent],
  })

  assert.equal(timeline.length, 1)
  assert.equal(timeline[0].kind, 'message')
  assert.equal(timeline[0].attribution.compositionId, 'CMP-1')
})

test('a draft that never became a message gets its own entry', () => {
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-1', createdAt: '2026-08-01T10:00:05Z' }],
    compositions: [sent, held],
  })

  assert.deepEqual(timeline.map(entry => entry.kind), ['message', 'composition'])
  assert.equal(timeline[1].composition.compositionId, 'CMP-2')
})

test('messages, drafts and status changes share one chronology', () => {
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-2', createdAt: '2026-08-01T11:00:00Z' }],
    compositions: [held],
    statusHistory: [{ changedAt: '2026-08-01T09:00:00Z', toStatus: 'QUEUED' }],
  })

  assert.deepEqual(timeline.map(entry => entry.kind), ['status', 'message', 'composition'])
})

test('an entry without a usable timestamp sorts last, not to 1970', () => {
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-3', createdAt: null }, { id: 'COMM-4', createdAt: '2026-08-01T10:00:00Z' }],
  })

  assert.deepEqual(timeline.map(entry => entry.id), ['COMM-4', 'COMM-3'])
})

test('only undecided drafts count as owed decisions', () => {
  const timeline = buildTimeline({
    compositions: [
      held,
      { compositionId: 'CMP-3', status: 'BLOCKED', communicationId: null, createdAt: '2026-08-01T13:00:00Z' },
      { compositionId: 'CMP-4', status: 'REJECTED', communicationId: null, createdAt: '2026-08-01T14:00:00Z' },
      { compositionId: 'CMP-5', status: 'APPROVED', communicationId: null, createdAt: '2026-08-01T15:00:00Z' },
    ],
  })

  assert.deepEqual(pendingDecisions(timeline).map(entry => entry.id), ['CMP-2', 'CMP-3'])
})

test('the index only claims compositions that were actually delivered', () => {
  const index = attributionByCommunication([sent, held])

  assert.equal(index.size, 1)
  assert.equal(index.get('COMM-1').compositionId, 'CMP-1')
})

test('a pending decision outranks every other conversation state', () => {
  const timeline = buildTimeline({ compositions: [held] })

  assert.deepEqual(
    conversationPulse({ negotiation: { status: 'ESCALATED' }, timeline }),
    { tone: 'warning', text: 'Ждёт решения: 1' },
  )
  assert.equal(
    conversationPulse({ negotiation: { lastWorkerError: 'smtp 550' }, timeline: [] }).tone,
    'danger',
  )
  assert.equal(
    conversationPulse({ negotiation: { status: 'WAITING_SUPPLIER' }, timeline: [] }).tone,
    'waiting',
  )
})

test('a quotation is attached to the message it was extracted from', () => {
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-1', kind: 'supplier', createdAt: '2026-08-01T10:00:00Z' }],
    quotes: [{ responseId: 'RESP-1', revision: 2, communicationId: 'COMM-1' }],
  })

  assert.equal(timeline[0].quotes[0].revision, 2)
  assert.equal(quotesByMessage([{ revision: 1 }]).size, 0)
})

test('the requirement change and the open escalation are events in the thread', () => {
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-1', createdAt: '2026-08-01T10:00:00Z' }],
    escalations: [{ id: 'ESC-1', createdAt: '2026-08-01T11:00:00Z' }],
    cardChange: { detectedAt: '2026-09-04T12:41:00Z' },
  })

  assert.deepEqual(
    timeline.map(entry => entry.kind),
    ['message', 'escalation', 'cardChange'],
  )
})

test('what has not been sent yet sits below the now line, in send order', () => {
  const negotiation = {
    id: 'NEG-1', status: 'QUEUED', nextAction: 'FOLLOW_UP', channel: 'whatsapp',
    nextActionAt: '2026-09-06T10:00:00Z',
  }
  const timeline = buildTimeline({
    messages: [{ id: 'COMM-1', createdAt: '2026-08-01T10:00:00Z' }],
    compositions: [
      { compositionId: 'CMP-2', status: 'DRAFT', communicationId: null, createdAt: '2026-08-01T12:00:00Z' },
      { compositionId: 'CMP-9', status: 'REJECTED', communicationId: null, createdAt: '2026-08-02T12:00:00Z' },
    ],
  })

  const { past, future } = splitFuture(timeline, negotiation)

  assert.deepEqual(past.map(entry => entry.id), ['COMM-1', 'CMP-9'])
  assert.deepEqual(future.map(entry => entry.id), ['CMP-2', 'planned:NEG-1'])
  assert.equal(future[1].channel, 'whatsapp')
})

test('a conversation with nothing scheduled plans nothing', () => {
  assert.equal(plannedAction({ status: 'ESCALATED', nextActionAt: '2026-09-06T10:00:00Z' }), null)
  assert.equal(plannedAction({ status: 'QUEUED' }), null)
})

test('a run of machine status changes folds into one entry', () => {
  const entries = [
    { kind: 'status', id: 's1', at: '1', event: { toStatus: 'QUEUED' } },
    { kind: 'status', id: 's2', at: '2', event: { toStatus: 'WAITING_SUPPLIER' } },
    { kind: 'status', id: 's3', at: '3', event: { toStatus: 'QUEUED' } },
    { kind: 'message', id: 'COMM-1', at: '4' },
    { kind: 'status', id: 's4', at: '5', event: { toStatus: 'ACTIVE' } },
  ]

  const folded = collapseStatusRuns(entries)

  assert.deepEqual(folded.map(entry => entry.kind), ['statusGroup', 'message', 'status'])
  assert.equal(folded[0].events.length, 3)
})

test('an unlinked response contributes its newest revision once, not five times', () => {
  const quotes = [
    { responseId: 'RESP-1', revision: 1, communicationId: null, receivedAt: '2026-08-01T10:00:00Z' },
    { responseId: 'RESP-1', revision: 3, communicationId: null, receivedAt: '2026-08-02T10:00:00Z' },
    { responseId: 'RESP-2', revision: 1, communicationId: 'COMM-1', receivedAt: '2026-08-03T10:00:00Z' },
  ]

  const unlinked = latestUnlinked(quotes)

  assert.deepEqual(unlinked.map(item => [item.responseId, item.revision, item.revisionCount]),
    [['RESP-1', 3, 2]])
  const timeline = buildTimeline({ quotes })
  assert.deepEqual(timeline.map(entry => entry.kind), ['quote'])
})
