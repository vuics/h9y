import test from 'node:test'
import assert from 'node:assert/strict'

import {
  NO_DATA,
  comparisonColumns,
  lookupsBySupplier,
  siteDocumentsCell,
  siteGradeCell,
  siteLookupsInProgress,
  siteRunProgress,
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
  assert.equal(siteGradeCell({ status: 'NOT_FOUND', checkedAt: '2026-09-24T10:22:00' }).reason, 'на сайте не указан · проверено 24.09.2026, 10:22')
  assert.equal(siteGradeCell({ status: 'STOPPED' }).reason, 'проверка остановлена')
  assert.equal(siteGradeCell({ status: 'PENDING' }).pending, true)
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

test('the table keeps polling only while a check is running', () => {
  assert.equal(siteLookupsInProgress({ siteLookups: [found] }), false)
  assert.equal(siteLookupsInProgress({ siteLookups: [found, { status: 'PENDING' }] }), true)
  // Never checked is not "in progress": polling for it would never end.
  assert.equal(siteLookupsInProgress({ siteLookups: [{ status: null }] }), false)
  assert.equal(siteLookupsInProgress({ siteRun: { running: true }, siteLookups: [] }), true)
  assert.equal(siteLookupsInProgress({ siteRun: { running: false }, siteLookups: [{ status: 'PENDING' }] }), false)
  assert.equal(siteLookupsInProgress({}), false)
})

test('the run reads as checked-of-total with what was found', () => {
  const progress = siteRunProgress({ running: true, total: 10, done: 3, found: 2 })
  assert.equal(progress.percent, 30)
  assert.equal(progress.text, 'Проверено 3 из 10 · грейд найден у 2')
  assert.equal(siteRunProgress({ total: 0 }), null)
  assert.equal(siteRunProgress({ running: false, total: 1, done: 1, found: 0, finishedAt: '2026-09-24T13:22:00' }).finishedAt, '24.09.2026, 13:22')
})
