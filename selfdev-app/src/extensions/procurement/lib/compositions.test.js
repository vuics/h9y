import test from 'node:test'
import assert from 'node:assert/strict'

import {
  approvalPayload, checkSummary, compositionActions, finalText, isPending,
} from './compositions.js'

test('only an undecided message offers a decision', () => {
  assert.equal(isPending('DRAFT'), true)
  assert.equal(isPending('BLOCKED'), true)
  assert.equal(isPending('SENT'), false)
  assert.equal(isPending('APPROVED'), false)
  assert.equal(isPending('REJECTED'), false)
})

test('decisions need the queue permission, and a blocked message stays editable', () => {
  assert.deepEqual(compositionActions('BLOCKED', { canQueue: true }), {
    canEdit: true, canApprove: true, canReject: true,
  })
  assert.deepEqual(compositionActions('DRAFT', { canQueue: false }), {
    canEdit: false, canApprove: false, canReject: false,
  })
  assert.deepEqual(compositionActions('SENT', { canQueue: true }), {
    canEdit: false, canApprove: false, canReject: false,
  })
})

test('the check summary keeps the failures that held the message back', () => {
  const summary = checkSummary([
    { check: 'NOT_EMPTY', status: 'PASSED', detail: 'ok' },
    { check: 'NO_FORBIDDEN_DISCLOSURE', status: 'FAILED', detail: 'цена раскрыта' },
    { check: 'VERBATIM_BLOCKS_PRESENT', status: 'SKIPPED', detail: 'нет блоков' },
  ])

  assert.equal(summary.passed, 1)
  assert.equal(summary.failed, 1)
  assert.equal(summary.skipped, 1)
  assert.deepEqual(summary.blocking.map(check => check.detail), ['цена раскрыта'])
})

test('the human edit is what would be sent', () => {
  assert.equal(finalText({ draftText: 'a', editedText: 'b' }), 'b')
  assert.equal(finalText({ draftText: 'a', editedText: null }), 'a')
  assert.equal(finalText(null), '')
})

test('an untouched draft is approved without claiming a human edited it', () => {
  const record = { draftText: 'Please confirm the lead time.', editedText: null }

  assert.deepEqual(approvalPayload(record, 'Please confirm the lead time.', ''), {})
  assert.deepEqual(approvalPayload(record, 'Please confirm the lead time.', 'ок'), { note: 'ок' })
  assert.deepEqual(
    approvalPayload(record, 'Please confirm the lead time and MOQ.', ''),
    { editedText: 'Please confirm the lead time and MOQ.' },
  )
})
