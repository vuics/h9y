import test from 'node:test'
import assert from 'node:assert/strict'

import { contentOf, memberAwaitsReview, modeOf, resolveOpen, rowOpenByMode, sectionOpenByMode, waitingOf } from './memberSections.js'

const withOffers = contentOf({ offers: [{}, {}], threads: [{}], marketplace: { status: 'POSTED' } })
const bare = contentOf({})

test('the address names the mode; anything else reads as positions', () => {
  assert.equal(modeOf('offers'), 'offers')
  assert.equal(modeOf('marketplace'), 'echemi')
  assert.equal(modeOf(null), 'waiting')
  assert.equal(modeOf('nonsense'), 'waiting')
})

test('positions opens nothing; all opens every row', () => {
  assert.equal(rowOpenByMode('members', withOffers), false)
  assert.equal(rowOpenByMode('all', bare), true)
})

test('a mode opens only the positions that have something for it', () => {
  assert.equal(rowOpenByMode('offers', withOffers), true)
  assert.equal(rowOpenByMode('offers', bare), false)
  assert.equal(rowOpenByMode('threads', withOffers), true)
  assert.equal(rowOpenByMode('echemi', bare), false)
})

test('a mode unfolds its own section and folds the others', () => {
  assert.equal(sectionOpenByMode('offers', 'offers'), true)
  assert.equal(sectionOpenByMode('offers', 'echemi'), false)
  assert.equal(sectionOpenByMode('echemi', 'echemi'), true)
  assert.equal(sectionOpenByMode('all', 'threads'), true)
})

test('a mode unfolds only its own section, even past a waiting conversation', () => {
  assert.equal(sectionOpenByMode('offers', 'threads'), false)
  assert.equal(sectionOpenByMode('echemi', 'threads'), false)
  assert.equal(sectionOpenByMode('threads', 'threads'), true)
})

test('a hand-made choice wins over the mode', () => {
  const overrides = new Map([['7:offers', false]])
  assert.equal(resolveOpen(overrides, '7:offers', true), false)
  assert.equal(resolveOpen(overrides, '8:offers', true), true)
})

test('the approval mode opens the positions waiting for it, and only its section', () => {
  assert.equal(rowOpenByMode('review', contentOf({ review: true })), true)
  assert.equal(rowOpenByMode('review', contentOf({ offers: [{}] })), false)
  assert.equal(sectionOpenByMode('review', 'review'), true)
  assert.equal(sectionOpenByMode('review', 'offers'), false)
  assert.equal(modeOf('review'), 'review')
})

test('a position waits for approval by its stage or by what it waits for', () => {
  assert.equal(memberAwaitsReview({ stage: 'AWAITING_REVIEW' }), true)
  assert.equal(memberAwaitsReview({ stage: 'SOURCING', waitingFor: 'RFQ_APPROVAL' }), true)
  assert.equal(memberAwaitsReview({ stage: 'NEGOTIATION', waitingFor: null }), false)
})

test('a mode with nothing anywhere opens every position', () => {
  assert.equal(rowOpenByMode('review', contentOf({}), { anyHas: false }), true)
  assert.equal(rowOpenByMode('review', contentOf({}), { anyHas: true }), false)
  assert.equal(rowOpenByMode('members', contentOf({}), { anyHas: false }), false)
})

test('the escalation mode opens the positions with an open case', () => {
  assert.equal(rowOpenByMode('escalations', contentOf({ escalations: [{ id: 'ESC-1' }] })), true)
  assert.equal(rowOpenByMode('escalations', contentOf({ offers: [{}] })), false)
  assert.equal(sectionOpenByMode('escalations', 'escalations'), true)
  assert.equal(sectionOpenByMode('escalations', 'review'), false)
})

test('waiting opens a position on each section that waits, and nothing else', () => {
  const waiting = waitingOf({ threads: [{ awaitingPerson: true }], escalations: [{ id: 'E' }] })
  const content = contentOf({ threads: [{}], escalations: [{}], offers: [{}], waiting })
  assert.equal(rowOpenByMode('waiting', content), true)
  assert.equal(sectionOpenByMode('waiting', 'threads', content), true)
  assert.equal(sectionOpenByMode('waiting', 'escalations', content), true)
  assert.equal(sectionOpenByMode('waiting', 'offers', content), false)
})

test('a company with nowhere to write to waits in its conversations', () => {
  const waiting = waitingOf({ unreachable: [{ supplierId: 'S' }] })
  assert.deepEqual([...waiting.sections], ['threads'])
  assert.equal(contentOf({ unreachable: [{}] }).threads, 1)
})

test('a card in error waits without opening a section', () => {
  const waiting = waitingOf({ error: true })
  assert.equal(waiting.waits, true)
  assert.equal(rowOpenByMode('waiting', contentOf({ waiting })), false)
  assert.equal(waitingOf({}).waits, false)
})
