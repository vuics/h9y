import test from 'node:test'
import assert from 'node:assert/strict'

import { CLASSIC_SECTIONS, MORE_SECTIONS, PRIMARY_SECTIONS, isPrimarySection, sectionOf } from './navigation.js'

test('the root and every campaign page belong to purchases', () => {
  assert.equal(sectionOf('/procurement'), 'purchases')
  assert.equal(sectionOf('/procurement/'), 'purchases')
  assert.equal(sectionOf('/procurement/campaigns'), 'purchases')
  assert.equal(sectionOf('/procurement/campaigns/CMP-1/review'), 'purchases')
})

test('the three tabs own their detail pages', () => {
  assert.equal(sectionOf('/procurement/escalations/ESC-7'), 'escalations')
  assert.equal(sectionOf('/procurement/proposals/compare'), 'proposals')
})

test('a screen behind «Все разделы» is named, not mistaken for a tab', () => {
  assert.equal(sectionOf('/procurement/overview'), 'overview')
  assert.equal(sectionOf('/procurement/requests/376/rfq'), 'requests')
  assert.equal(sectionOf('/procurement/communication/drafts/C-1'), 'communication')
  assert.equal(isPrimarySection(sectionOf('/procurement/suppliers/S-1')), false)
})

test('no screen of the old menu is lost', () => {
  const now = new Set([...PRIMARY_SECTIONS, ...MORE_SECTIONS].map(([, , path]) => path))
  for (const [, , path] of CLASSIC_SECTIONS) assert.ok(now.has(path), path)
})
