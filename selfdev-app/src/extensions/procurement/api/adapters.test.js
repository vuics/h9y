import test from 'node:test'
import assert from 'node:assert/strict'
import { adaptCard, adaptPage, adaptSupplier, detailViewState } from './adapters.js'

test('backend snake case is isolated from presentation models', () => {
  assert.deepEqual(adaptCard({ _id: 7, substance_name: 'Benzene', cas_number: '71-43-2', rfq_status: 'APPROVED' }), {
    _id: 7,
    substance_name: 'Benzene',
    cas_number: '71-43-2',
    rfq_status: 'APPROVED',
    id: 7,
    title: 'Benzene',
    casNumber: '71-43-2',
    substanceName: 'Benzene',
    targetVolume: undefined,
    rfqStatus: 'APPROVED',
    normalizationStatus: undefined,
    supplierCount: undefined,
    proposalCount: undefined,
    updatedAt: undefined,
  })
})

test('supplier adapter preserves contacts and capabilities as navigable models', () => {
  const supplier = adaptSupplier({ _id: 'SUP-1', canonical_name: 'Supplier', qualification_status: 'UNDER_REVIEW', contacts: [{ contact_id: 'C-1', verification_status: 'VERIFIED' }], capabilities: [{ cas_number: '71-43-2', verification_status: 'CLAIMED' }] })
  assert.equal(supplier.contacts[0].id, 'C-1')
  assert.equal(supplier.capabilities[0].casNumber, '71-43-2')
})

test('page adapter and detail states expose empty and error views', () => {
  assert.deepEqual(adaptPage({ items: [], page: 2, page_size: 25 }), { items: [], page: 2, pageSize: 25, total: undefined, hasMore: false })
  assert.equal(detailViewState({ loading: true }), 'loading')
  assert.equal(detailViewState({ error: new Error('offline') }), 'error')
  assert.equal(detailViewState({ value: null }), 'empty')
})
