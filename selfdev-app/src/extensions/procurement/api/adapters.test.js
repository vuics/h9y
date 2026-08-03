import test from 'node:test'
import assert from 'node:assert/strict'
import { adaptCard, adaptPage, adaptRFQ, adaptSupplier, detailViewState } from './adapters.js'

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

test('supplier adapter preserves contacts, capabilities and qualification audit as navigable models', () => {
  const supplier = adaptSupplier({ _id: 'SUP-1', canonical_name: 'Supplier', qualification_status: 'UNDER_REVIEW', qualification_status_updated_at: '2026-08-04T00:00:00Z', qualification_status_history: [{ from_status: 'UNVERIFIED', to_status: 'UNDER_REVIEW', actor_principal_key: 'USER:1', changed_at: '2026-08-04T00:00:00Z' }], source_profiles: [{ source: 'MANUAL', profile_status: 'UNVERIFIED' }], contacts: [{ contact_id: 'C-1', verification_status: 'VERIFIED', updated_at: '2026-08-04T00:00:00Z' }], capabilities: [{ cas_number: '71-43-2', verification_status: 'CLAIMED', source_product_id: 'P-1' }] })
  assert.equal(supplier.contacts[0].id, 'C-1')
  assert.equal(supplier.contacts[0].updatedAt, '2026-08-04T00:00:00Z')
  assert.equal(supplier.capabilities[0].casNumber, '71-43-2')
  assert.equal(supplier.capabilities[0].sourceProductId, 'P-1')
  assert.equal(supplier.qualificationHistory[0].toStatus, 'UNDER_REVIEW')
  assert.equal(supplier.qualificationHistory[0].actorPrincipalKey, 'USER:1')
  assert.equal(supplier.sourceProfiles[0].profileStatus, 'UNVERIFIED')
})

test('page adapter and detail states expose empty and error views', () => {
  assert.deepEqual(adaptPage({ items: [], page: 2, page_size: 25 }), { items: [], page: 2, pageSize: 25, total: undefined, hasMore: false })
  assert.equal(detailViewState({ loading: true }), 'loading')
  assert.equal(detailViewState({ error: new Error('offline') }), 'error')
  assert.equal(detailViewState({ value: null }), 'empty')
})

test('RFQ adapter preserves the exact bilingual preview and approval fingerprint', () => {
  const rfq = adaptRFQ({
    card_id: 7,
    rfq_status: 'AWAITING_APPROVAL',
    document_fingerprint: 'a'.repeat(64),
    rfq: {
      rfq_id: 'RFQ-7',
      generated_at: '2026-08-03T10:00:00Z',
      english: { subject: 'English', body_markdown: '# EN' },
      russian: { subject: 'Русский', body_markdown: '# RU' },
    },
  })
  assert.equal(rfq.cardId, 7)
  assert.equal(rfq.status, 'AWAITING_APPROVAL')
  assert.equal(rfq.documentFingerprint, 'a'.repeat(64))
  assert.equal(rfq.rfq.id, 'RFQ-7')
  assert.equal(rfq.rfq.english.bodyMarkdown, '# EN')
  assert.equal(rfq.rfq.russian.bodyMarkdown, '# RU')
})
