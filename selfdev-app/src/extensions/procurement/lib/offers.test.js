import test from 'node:test'
import assert from 'node:assert/strict'

import { groupOffersBySubstance, hasComparablePrice, priceRanges } from './offers.js'

const offer = (cardId, price, extra = {}) => ({ cardId, cardTitle: `Вещество ${cardId}`, price, currency: 'USD', priceUnit: 'KG', completeness: 'NEEDS_CLARIFICATION', updatedAt: '2026-09-18', ...extra })

test('an amount without currency or unit is not a comparable price', () => {
  assert.equal(hasComparablePrice(offer(1, 10)), true)
  assert.equal(hasComparablePrice(offer(1, 10, { currency: null })), false)
  assert.equal(hasComparablePrice(offer(1, null)), false)
})

test('prices are a range per currency and unit, never a single "best"', () => {
  assert.deepEqual(priceRanges([offer(1, 1200), offer(1, 831.51), offer(1, 5, { currency: 'CNY' }), offer(1, null)]), [
    '831.51–1200 USD/KG',
    '5 CNY/KG',
  ])
})

test('offers group by substance, the ones with prices first', () => {
  const groups = groupOffersBySubstance([
    offer(2, null),
    offer(1, 10, { completeness: 'COMPLETE' }),
    offer(1, 12),
    offer(2, null, { cardTitle: undefined }),
  ])
  assert.deepEqual(groups.map(group => [group.cardId, group.offers.length, group.priced, group.complete]), [[1, 2, 2, 1], [2, 2, 0, 0]])
  assert.equal(groups[0].title, 'Вещество 1')
})
