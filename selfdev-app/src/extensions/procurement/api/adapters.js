const safeArray = value => Array.isArray(value) ? value : []

export function adaptPage(payload, adapter = value => value) {
  const source = Array.isArray(payload) ? { items: payload } : (payload || {})
  const items = safeArray(source.items || source.data || source.results)
  return {
    items: items.map(adapter),
    page: Number(source.page || 1),
    pageSize: Number(source.pageSize || source.page_size || items.length || 20),
    total: source.total == null ? undefined : Number(source.total),
    hasMore: Boolean(source.hasMore ?? source.has_more),
  }
}

export function adaptCard(raw = {}) {
  return {
    ...raw,
    id: raw.id ?? raw.cardId ?? raw.card_id ?? raw._id,
    title: raw.title || raw.substanceName || raw.substance_name || `Карточка #${raw.id ?? raw._id}`,
    casNumber: raw.casNumber ?? raw.cas_number,
    substanceName: raw.substanceName ?? raw.substance_name,
    targetVolume: raw.targetVolume ?? raw.target_volume,
    rfqStatus: raw.rfqStatus ?? raw.rfq_status,
    normalizationStatus: raw.normalizationStatus ?? raw.normalization_status,
    supplierCount: raw.supplierCount ?? raw.supplier_count,
    proposalCount: raw.proposalCount ?? raw.proposal_count,
    updatedAt: raw.updatedAt ?? raw.updated_at,
  }
}

export function adaptSupplier(raw = {}) {
  return {
    ...raw,
    id: raw.id ?? raw.supplierId ?? raw.supplier_id ?? raw._id,
    name: raw.name || raw.canonicalName || raw.canonical_name,
    qualificationStatus: raw.qualificationStatus ?? raw.qualification_status,
    contacts: safeArray(raw.contacts).map(contact => ({
      ...contact,
      id: contact.id ?? contact.contactId ?? contact.contact_id,
      verificationStatus: contact.verificationStatus ?? contact.verification_status,
    })),
    capabilities: safeArray(raw.capabilities).map(capability => ({
      ...capability,
      casNumber: capability.casNumber ?? capability.cas_number,
      productName: capability.productName ?? capability.product_name,
      verificationStatus: capability.verificationStatus ?? capability.verification_status,
      sourceUrl: capability.sourceUrl ?? capability.source_url,
    })),
    updatedAt: raw.updatedAt ?? raw.updated_at,
  }
}

export function detailViewState({ loading, error, value }) {
  if (loading) return 'loading'
  if (error) return 'error'
  if (!value) return 'empty'
  return 'ready'
}
