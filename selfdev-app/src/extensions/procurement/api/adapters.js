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
    isDraft: Boolean(raw.isDraft ?? raw.is_draft),
    incompleteFields: safeArray(raw.incompleteFields || raw.incomplete_fields),
    importId: raw.importId ?? raw.import_id,
    importSourceRow: raw.importSourceRow ?? raw.import_source_row,
    updatedAt: raw.updatedAt ?? raw.updated_at,
  }
}

export function adaptRFQ(raw = {}) {
  const rfq = raw.rfq ? {
    ...raw.rfq,
    id: raw.rfq.id ?? raw.rfq.rfq_id,
    requestFingerprint: raw.rfq.requestFingerprint ?? raw.rfq.request_fingerprint,
    generatedAt: raw.rfq.generatedAt ?? raw.rfq.generated_at,
    english: raw.rfq.english && {
      ...raw.rfq.english,
      bodyMarkdown: raw.rfq.english.bodyMarkdown ?? raw.rfq.english.body_markdown,
      emailText: raw.rfq.english.emailText ?? raw.rfq.english.email_text,
    },
    russian: raw.rfq.russian && {
      ...raw.rfq.russian,
      bodyMarkdown: raw.rfq.russian.bodyMarkdown ?? raw.rfq.russian.body_markdown,
      emailText: raw.rfq.russian.emailText ?? raw.rfq.russian.email_text,
    },
  } : null
  return {
    ...raw,
    cardId: raw.cardId ?? raw.card_id,
    cardTitle: raw.cardTitle ?? raw.card_title,
    cardStatus: raw.cardStatus ?? raw.card_status,
    status: raw.status ?? raw.rfq_status ?? 'NOT_PREPARED',
    approvedAt: raw.approvedAt ?? raw.approved_at,
    approvedBy: raw.approvedBy ?? raw.approved_by,
    sentToSupplier: Boolean(raw.sentToSupplier ?? raw.sent_to_supplier),
    documentFingerprint: raw.documentFingerprint ?? raw.document_fingerprint,
    approvedNow: raw.approvedNow ?? raw.approved_now,
    rfq,
  }
}

export function adaptSupplier(raw = {}) {
  return {
    ...raw,
    id: raw.id ?? raw.supplierId ?? raw.supplier_id ?? raw._id,
    name: raw.name || raw.canonicalName || raw.canonical_name,
    qualificationStatus: raw.qualificationStatus ?? raw.qualification_status,
    qualificationUpdatedAt: raw.qualificationUpdatedAt ?? raw.qualification_status_updated_at,
    qualificationHistory: safeArray(raw.qualificationHistory || raw.qualification_status_history).map(item => ({
      ...item,
      fromStatus: item.fromStatus ?? item.from_status,
      toStatus: item.toStatus ?? item.to_status,
      actorPrincipalKey: item.actorPrincipalKey ?? item.actor_principal_key,
      changedAt: item.changedAt ?? item.changed_at,
    })),
    sourceProfiles: safeArray(raw.sourceProfiles || raw.source_profiles).map(item => ({
      ...item,
      profileStatus: item.profileStatus ?? item.profile_status,
      observedAt: item.observedAt ?? item.observed_at,
    })),
    contacts: safeArray(raw.contacts).map(contact => ({
      ...contact,
      id: contact.id ?? contact.contactId ?? contact.contact_id,
      verificationStatus: contact.verificationStatus ?? contact.verification_status,
      updatedAt: contact.updatedAt ?? contact.updated_at,
    })),
    capabilities: safeArray(raw.capabilities).map(capability => ({
      ...capability,
      casNumber: capability.casNumber ?? capability.cas_number,
      productName: capability.productName ?? capability.product_name,
      verificationStatus: capability.verificationStatus ?? capability.verification_status,
      sourceUrl: capability.sourceUrl ?? capability.source_url,
      sourceProductId: capability.sourceProductId ?? capability.source_product_id,
      observedAt: capability.observedAt ?? capability.observed_at,
    })),
    updatedAt: raw.updatedAt ?? raw.updated_at,
    createdAt: raw.createdAt ?? raw.created_at,
  }
}

export function detailViewState({ loading, error, value }) {
  if (loading) return 'loading'
  if (error) return 'error'
  if (!value) return 'empty'
  return 'ready'
}
