import test from 'node:test'
import assert from 'node:assert/strict'

import {
  NO_DATA,
  comparisonColumns,
  lookupsBySupplier,
  siteDocumentsCell,
  siteGradeCell,
  siteLookupsInProgress,
  siteWaterCell,
} from './siteGrade.js'

const found = {
  supplierId: 'SUP-1',
  status: 'FOUND',
  grades: [{ label: 'HPLC', quote: 'Grade: HPLC', sourceUrl: 'https://one.example/p' }, { label: 'Industrial grade', quote: '…', sourceUrl: 'https://one.example/p' }],
  sourceUrl: 'https://one.example/p',
  checkedAt: '2026-09-24T10:00:00+00:00',
  water: { value: '≤ 50 ppm', quote: 'Water (KF): ≤ 50 ppm', sourceUrl: 'https://one.example/p' },
  documents: { coa: 'https://one.example/coa.pdf' },
}

test('a found grade carries its source link and date', () => {
  const cell = siteGradeCell(found)
  assert.equal(cell.found, true)
  assert.equal(cell.text, 'HPLC, Industrial grade')
  assert.equal(cell.sourceUrl, 'https://one.example/p')
  assert.equal(cell.checkedAt, '24.09.2026')
})

test('every other outcome reads «нет данных» with its reason, never a guess', () => {
  assert.deepEqual(siteGradeCell({ status: 'NOT_FOUND', grades: [] }), { found: false, text: NO_DATA, reason: 'на сайте не указан' })
  assert.equal(siteGradeCell({ status: 'NO_WEBSITE' }).reason, 'сайт поставщика неизвестен')
  assert.equal(siteGradeCell({ status: 'UNREACHABLE' }).reason, 'сайт не открылся')
  assert.equal(siteGradeCell({ status: null }).reason, 'ещё не проверяли')
  assert.equal(siteGradeCell(undefined).text, NO_DATA)
  // FOUND without a grade is still no data: the cell never shows an empty mark.
  assert.equal(siteGradeCell({ status: 'FOUND', grades: [] }).text, NO_DATA)
})

test('water and documents from the site are shown only when read', () => {
  assert.equal(siteWaterCell(found).text, '≤ 50 ppm')
  assert.equal(siteWaterCell({}).text, NO_DATA)
  assert.deepEqual(siteDocumentsCell(found).links, [{ label: 'CoA', url: 'https://one.example/coa.pdf' }])
  assert.equal(siteDocumentsCell({ documents: {} }).text, NO_DATA)
})

test('suppliers asked but not yet answering get a column after the offers', () => {
  const columns = comparisonColumns({
    rows: [{ id: 'RESP-1', rowKey: 'RESP-1:0', supplierId: 'SUP-1' }],
    awaitingSuppliers: [{ supplierId: 'SUP-2', supplierName: 'Two', negotiationId: 'NEG-2' }],
  })
  assert.deepEqual(columns.map(item => item.rowKey), ['RESP-1:0', 'site:SUP-2'])
  assert.equal(columns[1].awaiting, true)
  assert.equal(lookupsBySupplier({ siteLookups: [found] }).get('SUP-1'), found)
})

test('the table keeps polling only while a site is still being read', () => {
  assert.equal(siteLookupsInProgress({ siteLookups: [found] }), false)
  assert.equal(siteLookupsInProgress({ siteLookups: [found, { status: 'PENDING' }] }), true)
  assert.equal(siteLookupsInProgress({ siteLookups: [{ status: null }] }), true)
  assert.equal(siteLookupsInProgress({}), false)
})
