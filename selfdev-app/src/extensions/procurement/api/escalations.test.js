import test from 'node:test'
import assert from 'node:assert/strict'

import { escalationActions, escalationOutcomeLabel } from './escalations.js'

test('escalation UI follows domain state transitions', () => {
  assert.deepEqual(escalationActions('OPEN'), {
    canClaim: true, canRecommend: true, canResolve: false,
  })
  assert.deepEqual(escalationActions('IN_REVIEW'), {
    canClaim: false, canRecommend: true, canResolve: true,
  })
  assert.deepEqual(escalationActions('RECOMMENDED'), {
    canClaim: true, canRecommend: false, canResolve: true,
  })
  assert.deepEqual(escalationActions('RESOLVED'), {
    canClaim: false, canRecommend: false, canResolve: false,
  })
})

test('expert outcomes have business-facing labels', () => {
  assert.equal(escalationOutcomeLabel('REQUEST_CLARIFICATION'), 'Запросить уточнение')
})
