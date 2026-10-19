import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSummary } from './normalizeSummary.js'

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
