import test from 'node:test'
import assert from 'node:assert/strict'

import { isMeaningfulEdit, sentenceDiff, suggestRule } from './learnFromEdit.js'

const record = {
  compositionId: 'CMP-7',
  supplierId: 'SUP-1',
  stage: 'CLARIFICATION',
  draftText: 'Please confirm the lead time. We look forward to your reply.',
  editedText: 'Please confirm the lead time. Please also confirm your export licence.',
}

test('the diff reports both what appeared and what the specialist removed', () => {
  const diff = sentenceDiff(record.draftText, record.editedText)

  assert.deepEqual(diff.added, ['Please also confirm your export licence.'])
  assert.deepEqual(diff.removed, ['We look forward to your reply.'])
})

test('a reflow is not knowledge and is not offered as a rule', () => {
  assert.equal(isMeaningfulEdit({ draftText: 'a b', editedText: 'a   b\n' }), false)
  assert.equal(isMeaningfulEdit({ draftText: 'a b', editedText: null }), false)
  assert.equal(isMeaningfulEdit(null), false)
  assert.equal(isMeaningfulEdit(record), true)
  assert.equal(suggestRule({ draftText: 'a b', editedText: 'a  b' }), null)
})

test('the suggestion carries both halves of the correction', () => {
  const rule = suggestRule(record)

  assert.match(rule.body, /Пиши так: Please also confirm your export licence\./)
  assert.match(rule.body, /Не пиши так: We look forward to your reply\./)
  assert.equal(rule.kind, 'DIRECTIVE')
  assert.equal(rule.provenance, 'LEARNED_FROM_EDIT')
  assert.equal(rule.sourceCompositionId, 'CMP-7')
})

test('a learned rule starts scoped to where it was learned', () => {
  const rule = suggestRule(record)

  assert.deepEqual(rule.scope.supplierIds, ['SUP-1'])
  assert.deepEqual(rule.scope.stages, ['CLARIFICATION'])
  assert.deepEqual(rule.scope.countries, [])
})

test('an edit that only adds text still produces a rule', () => {
  const rule = suggestRule({
    compositionId: 'CMP-8',
    draftText: 'Please quote.',
    editedText: 'Please quote. Confirm packaging.',
  })

  assert.match(rule.body, /^Пиши так: Confirm packaging\.$/)
  assert.deepEqual(rule.scope.supplierIds, [])
})
