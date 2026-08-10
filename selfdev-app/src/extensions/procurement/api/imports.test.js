import test from 'node:test'
import assert from 'node:assert/strict'

import {
  excludedRows,
  importFieldLabels,
  importLimits,
  isImportEditable,
  isImportRunning,
  pendingNormalizationCount,
  selectableRows,
  validateImportFile,
} from './imports.js'

const run = (rows, duplicatePolicy = 'SKIP') => ({ duplicatePolicy, rows })

test('every importable card field has a Russian label', () => {
  // Mirrors IMPORTABLE_CARD_FIELDS in card_import/models.py.
  assert.deepEqual(Object.keys(importFieldLabels), [
    'substance_name',
    'cas_number',
    'purity',
    'application_area',
    'target_volume',
    'price_guideline',
    'specialist_comments',
  ])
  assert.ok(Object.values(importFieldLabels).every(label => label.length > 0))
})

test('file validation rejects an empty or oversized upload', () => {
  assert.equal(validateImportFile(null), 'Выберите файл со списком веществ.')
  assert.equal(validateImportFile({ size: 0 }), 'Файл пустой.')
  assert.match(validateImportFile({ size: importLimits.maxFileBytes + 1 }), /15 МБ/)
  assert.equal(validateImportFile({ size: 4096 }), null)
})

test('selectable rows exclude what cannot become a card', () => {
  const rows = [
    { rowNumber: 2, status: 'READY' },
    { rowNumber: 3, status: 'DRAFT' },
    { rowNumber: 4, status: 'DUPLICATE' },
    { rowNumber: 5, status: 'EMPTY' },
    { rowNumber: 6, status: 'UNIDENTIFIED' },
  ]
  assert.deepEqual(selectableRows(run(rows)).map(row => row.rowNumber), [2, 3])
  assert.deepEqual(excludedRows(run(rows)).map(row => row.rowNumber), [4, 5, 6])
})

test('the CREATE duplicate policy makes duplicates selectable', () => {
  const rows = [
    { rowNumber: 2, status: 'READY' },
    { rowNumber: 4, status: 'DUPLICATE' },
  ]
  assert.deepEqual(selectableRows(run(rows, 'CREATE')).map(row => row.rowNumber), [2, 4])
  assert.deepEqual(excludedRows(run(rows, 'CREATE')), [])
})

test('the policy being chosen wins over the one stored on the run', () => {
  // Regression: during review the run still carries SKIP, because CREATE is only
  // stored at confirmation. Reading the stored value meant picking CREATE never
  // included the duplicates, and they were silently skipped.
  const rows = [
    { rowNumber: 2, status: 'READY' },
    { rowNumber: 4, status: 'DUPLICATE' },
    { rowNumber: 5, status: 'DUPLICATE' },
  ]
  const stored = run(rows, 'SKIP')

  assert.deepEqual(selectableRows(stored).map(row => row.rowNumber), [2])
  assert.deepEqual(
    selectableRows(stored, 'CREATE').map(row => row.rowNumber),
    [2, 4, 5],
  )
  assert.deepEqual(excludedRows(stored, 'CREATE'), [])
  assert.deepEqual(excludedRows(stored, 'SKIP').map(row => row.rowNumber), [4, 5])
})

test('mapping is editable only while awaiting confirmation', () => {
  assert.equal(isImportEditable({ status: 'AWAITING_CONFIRMATION' }), true)
  for (const status of ['ANALYZING', 'CREATING', 'NORMALIZING', 'COMPLETED', 'FAILED', 'CANCELLED']) {
    assert.equal(isImportEditable({ status }), false, status)
  }
})

test('running covers exactly the states the page must poll', () => {
  for (const status of ['ANALYZING', 'CREATING', 'NORMALIZING']) {
    assert.equal(isImportRunning({ status }), true, status)
  }
  for (const status of ['AWAITING_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED']) {
    assert.equal(isImportRunning({ status }), false, status)
  }
  assert.equal(isImportRunning(undefined), false)
})

test('pending normalization counts only created cards not yet checked', () => {
  assert.equal(pendingNormalizationCount(run([
    { rowNumber: 2, createdCardId: 1, normalizationStatus: null },
    { rowNumber: 3, createdCardId: 2, normalizationStatus: 'NORMALIZED' },
    { rowNumber: 4, createdCardId: null, normalizationStatus: null },
  ])), 1)
  assert.equal(pendingNormalizationCount(undefined), 0)
})
