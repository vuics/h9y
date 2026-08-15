import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attributionByCommunication, buildTimeline, conversationPulse, pendingDecisions,
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
