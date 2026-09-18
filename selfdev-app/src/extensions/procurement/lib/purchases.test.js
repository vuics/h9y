import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSubstances, purchaseSentence, purchaseSize, substancesToCsv, typedListFilename } from './purchases.js'

test('a line may hold a name, a CAS number or both, in either order', () => {
  assert.deepEqual(parseSubstances('Toluene 108-88-3\n\n108-88-3\nCAS 7732-18-5, Water\n2,4-Dichlorophenol'), [
    { name: 'Toluene', cas: '108-88-3' },
    { name: '', cas: '108-88-3' },
    { name: 'Water', cas: '7732-18-5' },
    { name: '2,4-Dichlorophenol', cas: '' },
  ])
  assert.deepEqual(parseSubstances('   \n'), [])
})

test('the typed list becomes the two-column table the import recognises', () => {
  assert.equal(
    substancesToCsv([{ name: 'Toluene', cas: '108-88-3' }, { name: 'He said "pure"', cas: '' }]),
    'Наименование,CAS\n"Toluene","108-88-3"\n"He said ""pure""",""',
  )
  assert.equal(typedListFilename([{ name: 'Toluene', cas: '108-88-3' }]), 'Toluene.csv')
})

test('a purchase says first what waits for a person', () => {
  const row = { status: 'RUNNING', progress: { total: 25, awaitingReview: 3, requestTotal: 10, responseTotal: 2 } }
  assert.deepEqual(purchaseSentence(row), { text: 'Ждёт вашего согласования: 3 вещества', tone: 'warning' })
  assert.equal(purchaseSentence({ ...row, progress: { ...row.progress, awaitingReview: 0 } }).text, '2 ответа поставщиков на 10 запросов')
  assert.equal(purchaseSentence({ status: 'CANCELLED', progress: row.progress }).text, 'Остановлена')
})

test('a purchase of one substance reads as that substance, without "0 из 1"', () => {
  const single = { status: 'RUNNING', progress: { total: 1 }, substance: { stage: 'SOURCING' } }
  assert.equal(purchaseSentence(single).text, 'Ищем поставщиков')
  assert.equal(purchaseSize(single), '')
  assert.equal(purchaseSize({ progress: { total: 4 } }), '4 вещества')
})
