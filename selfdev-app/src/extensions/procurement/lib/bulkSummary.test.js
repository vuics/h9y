import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSummary, prepareSummary } from './bulkSummary.js'

test('what needs a person comes first in the summary', () => {
  assert.equal(
    normalizeSummary({ results: [
      { cardId: 1, outcome: 'NORMALIZED' },
      { cardId: 2, outcome: 'UNCONFIRMED', status: 'NEEDS_REVIEW' },
      { cardId: 3, outcome: 'SKIPPED' },
    ] }),
    'не подтверждено PubChem: 1 — проверьте карточку; нормализовано: 1; уже были нормализованы: 1',
  )
  assert.equal(normalizeSummary({ results: [] }), 'Нечего нормализовать')
})

test('an RFQ that could not be written is named with its card', () => {
  assert.equal(
    prepareSummary({ prepared: [1], failed: [{ cardId: 2, code: 'CARD_NOT_NORMALIZED' }] }, 3),
    'не подготовлено: #2 (CARD_NOT_NORMALIZED); подготовлено RFQ: 1; уже были: 1',
  )
})
