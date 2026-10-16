import test from 'node:test'
import assert from 'node:assert/strict'

import { contentOf, modeOf, resolveOpen, rowOpenByMode, sectionOpenByMode } from './memberSections.js'

const withOffers = contentOf({ offers: [{}, {}], threads: [{}], marketplace: { status: 'POSTED' } })
const bare = contentOf({})

test('the address names the mode; anything else reads as positions', () => {
  assert.equal(modeOf('offers'), 'offers')
  assert.equal(modeOf('marketplace'), 'echemi')
  assert.equal(modeOf(null), 'members')
  assert.equal(modeOf('nonsense'), 'members')
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

test('a conversation waiting for a person is never folded by a mode', () => {
  assert.equal(sectionOpenByMode('offers', 'threads', { waiting: true }), true)
  assert.equal(sectionOpenByMode('offers', 'threads', { waiting: false }), false)
})

test('a hand-made choice wins over the mode', () => {
  const overrides = new Map([['7:offers', false]])
  assert.equal(resolveOpen(overrides, '7:offers', true), false)
  assert.equal(resolveOpen(overrides, '8:offers', true), true)
})
