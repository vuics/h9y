import test from 'node:test'
import assert from 'node:assert/strict'

import { groupOffersBySubstance, hasComparablePrice, offerBasis, offerNote, priceRanges, sortByPrice, splitSuppliers, statusTally, threadsWithOffers } from './offers.js'

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

test('offers sort cheapest first within a currency, unpriced last', () => {
  const sorted = sortByPrice([
    offer(1, 142, { id: 'c' }),
    offer(1, null, { id: 'none' }),
    offer(1, 140, { id: 'cny', currency: 'CNY' }),
    offer(1, 113.5, { id: 'a' }),
  ])
  assert.deepEqual(sorted.map(item => item.id), ['cny', 'a', 'c', 'none'])
})

test('basis and note read as the supplier wrote them', () => {
  assert.equal(offerBasis({ incoterm: 'CIP', namedPlace: 'Москва' }), 'CIP Москва')
  assert.equal(offerBasis({ incoterm: 'EXW', namedPlace: null }), 'EXW')
  assert.equal(offerNote({ moq: '1 MT', paymentTerms: '100% T/T' }), 'MOQ 1 MT; 100% T/T')
  assert.equal(offerNote({}), '')
})

test('suppliers split into offered and silent, people first among the silent', () => {
  const threads = [
    { assignmentId: 'NEG-1', supplierId: 'S1', status: 'WAITING_SUPPLIER' },
    { assignmentId: 'NEG-2', supplierId: 'S2', status: 'WAITING_SUPPLIER' },
    { assignmentId: 'NEG-3', supplierId: 'S3', status: 'QUEUED', awaitingPerson: true },
  ]
  const { offered, silent } = splitSuppliers([offer(1, 10, { negotiationId: 'NEG-1' }), offer(1, 9, { supplierId: 'ECHEMI-7' })], threads)
  assert.deepEqual(offered.map(row => row.thread?.assignmentId ?? null), [null, 'NEG-1'])
  assert.deepEqual(silent.map(thread => thread.assignmentId), ['NEG-3', 'NEG-2'])
})

test('the silent ones are tallied by status, largest group first', () => {
  const threads = [{ s: 'в очереди' }, { s: 'ждём поставщика' }, { s: 'ждём поставщика' }]
  assert.equal(statusTally(threads, thread => thread.s), '2 ждём поставщика · 1 в очереди')
})

test('every conversation keeps its offer, people first, then offers', () => {
  const threads = [
    { assignmentId: 'NEG-1', supplierId: 'S1' },
    { assignmentId: 'NEG-2', supplierId: 'S2' },
    { assignmentId: 'NEG-3', supplierId: 'S3', awaitingPerson: true },
  ]
  const rows = threadsWithOffers([offer(1, 10, { id: 'R2', negotiationId: 'NEG-2' })], threads)
  assert.deepEqual(rows.map(row => [row.thread.assignmentId, row.offer?.id ?? null]), [['NEG-3', null], ['NEG-2', 'R2'], ['NEG-1', null]])
})
