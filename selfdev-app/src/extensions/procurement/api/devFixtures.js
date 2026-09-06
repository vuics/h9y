const ago = hours => new Date(Date.now() - hours * 3600000).toISOString()

export const cards = [
  { id: 1042, title: '1,3-бутадиен — промышленная партия', substanceName: '1,3-Butadiene', casNumber: '106-99-0', purity: '≥ 99.5%', targetVolume: '20 MT', stage: 'NEGOTIATION', rfqStatus: 'APPROVED', normalizationStatus: 'NORMALIZED', completeness: 'NEEDS_CLARIFICATION', supplierCount: 4, proposalCount: 3, sourcing: { runId: 'SRC-1042-DEMO', status: 'COMPLETED', candidateCount: 2, greenCandidateCount: 1, verifiedCandidateCount: 1 }, updatedAt: ago(1) },
  { id: 1038, title: 'Силиконовый модификатор для косметики', substanceName: 'Silicone modifier', casNumber: '63148-62-9', purity: 'Cosmetic grade', targetVolume: '2 MT', stage: 'SOURCING', rfqStatus: 'AWAITING_APPROVAL', normalizationStatus: 'NEEDS_REVIEW', completeness: 'NEEDS_HUMAN_REVIEW', supplierCount: 7, proposalCount: 1, updatedAt: ago(4) },
  { id: 1031, title: 'Бензол, аналитический стандарт', substanceName: 'Benzene', casNumber: '71-43-2', purity: '≥ 99.9%', targetVolume: '25 KG', stage: 'COMPARISON', rfqStatus: 'APPROVED', normalizationStatus: 'NORMALIZED', completeness: 'COMPLETE', supplierCount: 3, proposalCount: 3, updatedAt: ago(9) },
  { id: 1024, title: 'Формальдегид 37%', substanceName: 'Formaldehyde solution', casNumber: '50-00-0', purity: '37%', targetVolume: '5 MT', stage: 'WAITING_SUPPLIER', rfqStatus: 'APPROVED', normalizationStatus: 'NORMALIZED', completeness: 'NEEDS_CLARIFICATION', supplierCount: 5, proposalCount: 2, updatedAt: ago(27) },
]

const sourcingRun = {
  id: 'SRC-1042-DEMO', cardId: 1042, requestedCas: '106-99-0', requestedProductName: '1,3-Butadiene', status: 'COMPLETED',
  queryPlan: ['"106-99-0" manufacturer production capacity', '"1,3-Butadiene" environmental permit plant'],
  sources: [
    { id: 'SOURCE-1', url: 'https://example.invalid/company/butadiene', finalUrl: 'https://example.invalid/company/butadiene', domain: 'example.invalid', title: 'Jiangsu Meridian Materials — Butadiene', sourceType: 'OFFICIAL_COMPANY', query: '"106-99-0" manufacturer', retrievedAt: ago(3), fetchStatus: 'FETCHED', claimCount: 3, extractionWarnings: [], status: 'ANALYZED', retryable: false },
    { id: 'SOURCE-2', url: 'https://regulator.example.invalid/permit/42', finalUrl: 'https://regulator.example.invalid/permit/42', domain: 'regulator.example.invalid', title: 'Environmental operating permit', sourceType: 'REGULATOR', query: 'butadiene environmental permit', retrievedAt: ago(2), fetchStatus: 'FETCHED', claimCount: 2, extractionWarnings: [], status: 'ANALYZED', retryable: false },
    { id: 'SOURCE-3', url: 'https://market.example.invalid/listing/77', finalUrl: 'https://market.example.invalid/listing/77', domain: 'market.example.invalid', title: 'Butadiene supplier listing', sourceType: 'MARKETPLACE', query: '106-99-0 supplier', retrievedAt: ago(2), fetchStatus: 'FETCHED', claimCount: 1, extractionWarnings: [], status: 'ANALYZED', retryable: false },
  ],
  candidates: [
    { id: 'CAND-MERIDIAN', name: 'Jiangsu Meridian Materials', aliases: ['Meridian Materials'], country: 'CN', website: 'https://example.invalid/company', role: 'MANUFACTURER', score: 86, preliminaryStatus: 'GREEN', reviewDecision: 'VERIFIED_MANUFACTURER', promotedSupplierId: 'SUP-B72D', reliabilitySignals: [{ text: 'Точный CAS указан в официальном каталоге', points: 30, potential: 0 }, { text: 'Производственная площадка подтверждена разрешением регулятора', points: 25, potential: 0 }, { text: 'Заявлена мощность 120 000 тонн в год', points: 10, potential: 0 }], riskSignals: [], evidenceGaps: [{ text: 'Экспортная лицензия требует актуализации', points: 0, potential: 10 }], contacts: [{ channel: 'email', address: 'sales@example.invalid', sourceUrl: 'https://example.invalid/contact', retrievedAt: ago(1), discoveredBy: 'SITE_PROBE' }], sourceIds: ['SOURCE-1', 'SOURCE-2'], evidence: [
      { id: 'CLAIM-1', category: 'PRODUCT_MATCH', polarity: 'POSITIVE', value: 'CAS 106-99-0 присутствует в каталоге', quote: '1,3-Butadiene, CAS No. 106-99-0, polymerization grade.', sourceId: 'SOURCE-1', sourceUrl: 'https://example.invalid/company/butadiene', sourceType: 'OFFICIAL_COMPANY', sourceRetrievedAt: ago(3) },
      { id: 'CLAIM-2', category: 'PRODUCTION_CAPACITY', polarity: 'POSITIVE', value: '120 000 тонн в год', quote: 'The production unit has a nameplate capacity of 120,000 metric tonnes per year.', sourceId: 'SOURCE-1', sourceUrl: 'https://example.invalid/company/butadiene', sourceType: 'OFFICIAL_COMPANY', sourceRetrievedAt: ago(3) },
      { id: 'CLAIM-3', category: 'ENVIRONMENTAL_PERMIT', polarity: 'POSITIVE', value: 'Разрешение на эксплуатацию установки', quote: 'Permit covers operation of the butadiene extraction unit at the listed facility.', sourceId: 'SOURCE-2', sourceUrl: 'https://regulator.example.invalid/permit/42', sourceType: 'REGULATOR', sourceRetrievedAt: ago(2), validUntil: '2028-12-31' },
    ], reviewHistory: [{ decision: 'VERIFIED_MANUFACTURER', note: 'Сопоставлены официальный каталог и действующее разрешение регулятора. CAS и площадка совпадают.', actorPrincipalKey: 'USER:fixture-buyer', reviewedAt: ago(1) }] },
    { id: 'CAND-TRADING', name: 'Fixture Industrial Trading', aliases: [], country: 'CN', website: 'https://market.example.invalid/listing/77', role: 'UNKNOWN', score: 34, preliminaryStatus: 'RED', reviewDecision: 'UNREVIEWED', reliabilitySignals: [{ text: 'Найден листинг с точным CAS', points: 10, potential: 0 }], riskSignals: [{ text: 'Найдена только B2B-площадка', points: -15, potential: 0 }, { text: 'Нет подтверждения собственного производства', points: -20, potential: 0 }], evidenceGaps: [{ text: 'Производственная площадка', points: 0, potential: 25 }, { text: 'Мощности', points: 0, potential: 10 }, { text: 'Лицензии и разрешения', points: 0, potential: 10 }], contacts: [], sourceIds: ['SOURCE-3'], evidence: [{ id: 'CLAIM-4', category: 'PRODUCT_MATCH', polarity: 'POSITIVE', value: 'Листинг с CAS 106-99-0', quote: 'High purity 1,3-butadiene, CAS 106-99-0 available for export.', sourceId: 'SOURCE-3', sourceUrl: 'https://market.example.invalid/listing/77', sourceType: 'MARKETPLACE', sourceRetrievedAt: ago(2) }], reviewHistory: [] },
  ],
  errors: [], initiatedByPrincipalKey: 'USER:fixture-buyer', createdAt: ago(4), updatedAt: ago(1), completedAt: ago(1), automaticVerification: false,
  progress: { stage: 'COMPLETED', discoveredSources: 3, processedSources: 3, percent: 100, sourceStatusCounts: { ANALYZED: 3 }, evidenceSources: 3, retryableSources: 0 },
  decisionNote: 'Traffic-light status is preliminary and evidence-based. Only an authorized human review may verify a manufacturer or distributor.',
}

const defaultQueryTemplates = [
  '"{cas}" manufacturer producer',
  '"{name}" manufacturer production plant',
  '"{cas}" "production capacity"',
  '"{name}" environmental permit regulator',
]

export const sourcingQueryTemplates = {
  templates: defaultQueryTemplates.map((template, index) => ({ id: `QT-FIXTURE-${index}`, template, enabled: true })),
  variables: ['cas', 'name'],
  defaultTemplates: defaultQueryTemplates,
  isDefault: true,
  updatedAt: null,
  updatedByPrincipalKey: null,
  scopeNote: 'The search plan is shared by every procurement card in this installation.',
}

export const sourcingEngines = {
  engines: [
    { id: 'brave', label: 'Brave Search', kind: 'WEB_SEARCH', available: true, detail: 'Готов к работе.' },
    { id: 'ddgs', label: 'DuckDuckGo (ddgs)', kind: 'WEB_SEARCH', available: true, detail: 'Не требует ключа API.' },
    { id: 'openserp', label: 'OpenSERP', kind: 'WEB_SEARCH', available: false, detail: 'Не задан OPENSERP_BASE_URL.' },
  ],
  // Measured on the installation's own finished runs; the fixture states a
  // plausible one so the cost note has something to render.
  analysisSecondsPerSource: 12,
  maxAnalysedSources: 300,
  configuredBy: 'SOURCING_SEARCH_ENGINES',
  scopeNote: 'Which engines exist is a deployment decision; which of them a run uses is chosen per run.',
}

export function sourcingFixtureForCard(cardId) {
  return String(cardId) === String(sourcingRun.cardId) ? sourcingRun : null
}

export function sourcingFixtureById(runId) {
  return String(runId) === sourcingRun.id ? sourcingRun : null
}

// One campaign in each state a reader needs to recognise: a run still going,
// and a finished one whose remaining work is a decision rather than a search.
const campaigns = [
  {
    campaignId: 'CMP-FIXTURE01',
    title: '1,3-Бутадиен и ещё 3',
    status: 'AWAITING_REVIEW',
    reach: 'OUTREACH',
    importId: 'IMP-FIXTURE01',
    progress: { total: 4, settled: 4, awaitingReview: 3, failed: 1, byStage: { AWAITING_REVIEW: 3, FAILED: 1 }, candidateTotal: 27, contactTotal: 19 },
    createdAt: ago(4),
    updatedAt: ago(2),
    completedAt: ago(2),
    plan: { reach: 'OUTREACH', channels: ['EMAIL', 'ECHEMI', 'WEB_FORM'], approveRfq: true, draftFirst: false, maxResults: 10, engineIds: null, queryTemplateIds: null, siteProbe: true },
    errors: [],
    cancelRequested: false,
    members: [
      { cardId: 90001, title: '1,3-Бутадиен', casNumber: '106-99-0', stage: 'AWAITING_REVIEW', sourcingRunId: 'SRC-RUN-90001', candidateCount: 9, contactCount: 7, verifiedCount: 0, requestCount: 0, responseCount: 0, escalationCount: 0, errorCode: null, waitingFor: 'CANDIDATE_REVIEW', startedAt: ago(4), finishedAt: ago(3) },
      { cardId: 90002, title: 'Ксилит', casNumber: '87-99-0', stage: 'AWAITING_REVIEW', sourcingRunId: 'SRC-RUN-90002', candidateCount: 11, contactCount: 8, verifiedCount: 0, requestCount: 0, responseCount: 0, escalationCount: 0, errorCode: null, waitingFor: 'CANDIDATE_REVIEW', startedAt: ago(4), finishedAt: ago(3) },
      { cardId: 90003, title: 'Глицин', casNumber: '56-40-6', stage: 'AWAITING_REVIEW', sourcingRunId: 'SRC-RUN-90003', candidateCount: 7, contactCount: 4, verifiedCount: 0, requestCount: 0, responseCount: 0, escalationCount: 0, errorCode: null, waitingFor: 'CANDIDATE_REVIEW', startedAt: ago(4), finishedAt: ago(2) },
      { cardId: 90004, title: 'Бензол', casNumber: '71-43-2', stage: 'FAILED', sourcingRunId: null, candidateCount: 0, contactCount: 0, verifiedCount: 0, requestCount: 0, responseCount: 0, escalationCount: 0, errorCode: 'CARD_NOT_NORMALIZED', waitingFor: null, startedAt: ago(4), finishedAt: ago(4) },
    ],
  },
]

// The list carries the summary only, exactly as the API's own list route does:
// a fixture that returned members would hide a page reading a field the real
// response never sends.
export const campaignList = {
  items: campaigns.map(item => ({
    campaignId: item.campaignId,
    title: item.title,
    status: item.status,
    reach: item.reach,
    importId: item.importId,
    progress: item.progress,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    completedAt: item.completedAt,
  })),
}

export function campaignReviewFixture(campaignId) {
  const campaign = campaigns.find(item => item.campaignId === String(campaignId))
  if (!campaign) return null
  const candidate = (suffix, role, score, decision = 'UNREVIEWED') => ({
    candidateId: `CAND-${suffix}`,
    name: `Zhejiang ${suffix} Chemical Co.`,
    country: 'CN',
    website: `https://${suffix.toLowerCase()}.example.invalid`,
    role,
    score,
    preliminaryStatus: score >= 70 ? 'GREEN' : 'YELLOW',
    reviewDecision: decision,
    promotedSupplierId: null,
    contactCount: score >= 70 ? 2 : 0,
    signals: ['Продукт подтверждён на официальном сайте', 'Роль производителя заявлена на сайте'],
    risks: score >= 70 ? [] : ['Источники содержат противоречивые сведения'],
  })
  return {
    campaignId: campaign.campaignId,
    title: campaign.title,
    status: campaign.status,
    approveRfq: true,
    pendingCandidates: 4,
    pendingRfq: 2,
    items: campaign.members.map(member => ({
      cardId: member.cardId,
      title: member.title,
      casNumber: member.casNumber,
      stage: member.stage,
      sourcingRunId: member.sourcingRunId,
      blockedBy: member.stage === 'FAILED' ? member.errorCode : null,
      candidates: member.stage === 'AWAITING_REVIEW'
        ? [candidate(`${member.cardId}A`, 'MANUFACTURER', 78), candidate(`${member.cardId}B`, 'UNKNOWN', 54)]
        : [],
      rfq: member.stage === 'AWAITING_REVIEW'
        ? {
          status: 'PREPARED',
          documentFingerprint: 'a'.repeat(64),
          approvedAt: null,
          subject: `Request for quotation — ${member.title} (CAS ${member.casNumber})`,
          bodyMarkdown: `Dear Sir or Madam,\n\nWe are sourcing ${member.title}, CAS ${member.casNumber}.`,
        }
        : null,
    })),
  }
}

export function campaignFixtureById(campaignId) {
  return campaigns.find(item => item.campaignId === String(campaignId)) || null
}

export function campaignConversationsFixture(campaignId) {
  const campaign = campaigns.find(item => item.campaignId === String(campaignId))
  if (!campaign) return null
  // Demonstration mode shows the case the screen exists for: requests prepared
  // under draft-first, every one of them waiting for a person to send it.
  const items = campaign.members
    .filter(member => member.stage === 'AWAITING_REVIEW')
    .map((member, index) => ({
      cardId: member.cardId,
      title: member.title,
      casNumber: member.casNumber,
      awaitingPerson: 1,
      conversations: [{
        assignmentId: `NEG-${member.cardId}-${index}F`,
        supplierId: suppliers[index % suppliers.length].id,
        supplierName: suppliers[index % suppliers.length].name,
        channel: 'email',
        status: 'READY',
        nextAction: 'SEND_INITIAL_RFQ',
        automationPaused: false,
        answered: false,
        awaitingPerson: true,
      }],
    }))
  return {
    campaignId: campaign.campaignId,
    draftFirst: true,
    channels: ['EMAIL', 'WEB_FORM'],
    items,
    total: items.length,
    awaitingPerson: items.length,
    // The other half of the story the screen tells: verified companies the
    // campaign has no allowed way to write to.
    unreachable: campaign.members.slice(0, 1).map(member => ({
      cardId: member.cardId,
      title: member.title,
      casNumber: member.casNumber,
      suppliers: [{
        supplierId: suppliers[1].id,
        name: suppliers[1].name,
        otherChannels: ['whatsapp'],
      }],
    })),
    unreachableTotal: 1,
  }
}

export function campaignMarketplaceFixture(campaignId) {
  const campaign = campaigns.find(item => item.campaignId === String(campaignId))
  if (!campaign) return null
  // One request per substance, in the three states the block has to explain:
  // posted, waiting for the specialist's approval, and blocked on an RFQ.
  const states = ['SUBMITTED', 'AWAITING_APPROVAL', 'RFQ_APPROVAL']
  const items = campaign.members.map((member, index) => ({
    cardId: member.cardId,
    title: member.title,
    casNumber: member.casNumber,
    status: states[index % states.length],
    inquiryId: `ECHEMI-${member.cardId}-4F2A`,
    platformInquiryId: index % states.length === 0 ? 'RFQ2043117' : null,
    error: null,
  }))
  return {
    campaignId: campaign.campaignId,
    enabled: true,
    items,
    total: items.length,
    posted: items.filter(item => item.status === 'SUBMITTED').length,
    pending: items.filter(item => item.status === 'PREPARED').length,
    awaitingApproval: items.filter(item => item.status === 'AWAITING_APPROVAL').length,
    running: false,
  }
}

export const suppliers = [
  { id: 'SUP-A19F', name: 'Qingdao Nova Chemical Co.', country: 'CN', qualificationStatus: 'UNDER_REVIEW', contacts: [{ id: 'CONTACT-91', name: 'Lin Wei', role: 'Export manager', channel: 'email', address: 'lin.wei@fixture.invalid', verificationStatus: 'VERIFIED', active: true }], capabilities: [{ casNumber: '106-99-0', productName: '1,3-Butadiene', verificationStatus: 'CLAIMED', source: 'ECHEMI_MARKETPLACE_LISTING', sourceUrl: 'https://example.invalid/source/1' }], updatedAt: ago(1) },
  { id: 'SUP-B72D', name: 'Jiangsu Meridian Materials', country: 'CN', qualificationStatus: 'QUALIFIED', contacts: [{ id: 'CONTACT-27', name: 'Mei Chen', role: 'International sales', channel: 'whatsapp', address: '+86 •••• 1842', verificationStatus: 'VERIFIED', active: true }], capabilities: [{ casNumber: '106-99-0', productName: 'Butadiene, polymerization grade', verificationStatus: 'VERIFIED', source: 'OFFICIAL_CATALOGUE', sourceUrl: 'https://example.invalid/source/2' }], updatedAt: ago(3) },
  { id: 'SUP-C11A', name: 'Arclight Fine Chemicals', country: 'DE', qualificationStatus: 'UNVERIFIED', contacts: [{ id: 'CONTACT-33', name: 'Sofia Klein', role: 'Sales', channel: 'email', address: 'sofia.klein@fixture.invalid', verificationStatus: 'UNVERIFIED', active: true }], capabilities: [{ casNumber: '71-43-2', productName: 'Benzene analytical standard', verificationStatus: 'CLAIMED', source: 'MANUAL' }], updatedAt: ago(16) },
]

export const negotiations = [
  { id: 'NEG-1042-A1', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, contactId: 'CONTACT-91', contactName: 'Lin Wei', channel: 'email', status: 'WAITING_SUPPLIER', nextAction: 'FOLLOW_UP', nextActionAt: ago(-18), lastDispatchStatus: 'DELIVERED', requiresHuman: false, updatedAt: ago(7) },
  { id: 'NEG-1042-B2', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, contactId: 'CONTACT-27', contactName: 'Mei Chen', channel: 'whatsapp', status: 'ESCALATED', nextAction: 'FOLLOW_UP', lastDispatchStatus: 'DELIVERED', requiresHuman: true, updatedAt: ago(2) },
  // Paused because the card moved under it: the conversation is alive, and one
  // decision — continue, restart, stop — is owed by a person.
  { id: 'NEG-1042-C3', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, contactId: 'CONTACT-91', contactName: 'Lin Wei', channel: 'email', status: 'PAUSED_BY_CHANGE', nextAction: 'FOLLOW_UP', lastDispatchStatus: 'DELIVERED', requiresHuman: false, updatedAt: ago(1), cardChange: { detectedAt: ago(1), previousRfqId: 'RFQ-1042', currentRfqId: 'RFQ-1042', rfqStatus: 'DRAFT', rfqApproved: false, changedFields: [{ field: 'target_volume', before: '20 MT', after: '35 MT' }, { field: 'purity', before: '99.5%', after: '99.7%' }], draftStatus: 'PREPARING', draftCompositionId: null, resolution: null } },
  { id: 'NEG-1024-A3', cardId: 1024, cardTitle: cards[3].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, contactId: 'CONTACT-91', contactName: 'Lin Wei', channel: 'email', status: 'FAILED', nextAction: 'SEND_INITIAL_RFQ', lastDispatchStatus: 'FAILED', lastWorkerError: 'Почтовый шлюз отклонил сообщение после последней попытки.', requiresHuman: true, updatedAt: ago(13) },
]

export const messages = [
  { id: 'MSG-1', kind: 'system_outbound', author: 'Procurement Agent', text: 'RFQ-1042 отправлен: запрошены цена, MOQ, CoA/TDS, сроки и условия оплаты.', createdAt: ago(30), status: 'DELIVERED' },
  { id: 'MSG-2', kind: 'supplier', author: 'Lin Wei', channel: 'email', text: 'Предлагаем 1,3-бутадиен 99,5%. Цена — 1 240 USD/MT, FCA Shanghai. MOQ 18 MT.', createdAt: ago(9), status: 'RECEIVED', sourceId: 'SRC-1042-01', spans: [
    { field: 'purity', label: 'Чистота', value: '99.5%', status: 'PRESENT', start: 24, end: 29, quote: '99,5%' },
    { field: 'price', label: 'Цена', value: '1240', status: 'PRESENT', start: 38, end: 50, quote: '1 240 USD/MT' },
    { field: 'incoterm', label: 'Базис', value: 'FCA', status: 'PRESENT', start: 52, end: 64, quote: 'FCA Shanghai' },
    { field: 'moq', label: 'MOQ', value: '18 MT', status: 'PRESENT', start: 66, end: 75, quote: 'MOQ 18 MT' },
  ] },
  { id: 'MSG-3', kind: 'interpretation', author: 'Supplier Response Intelligence', text: 'Извлечены цена, валюта, базис и MOQ. Не подтверждены CoA, TDS, срок поставки и условия оплаты.', createdAt: ago(8), status: 'PROCESSED' },
  { id: 'MSG-4', kind: 'human', author: 'Специалист закупок', text: 'Проверить, входит ли экспортное оформление в FCA, и запросить образец.', createdAt: ago(6), status: 'RECORDED' },
]

/** Contacts the demonstration supplier can actually be written to. */
export const negotiationContacts = [
  { contactId: 'CONTACT-91', name: 'Lin Wei', channel: 'email', address: 'lin.wei@qingdao-nova.example', verificationStatus: 'VERIFIED', active: true, usable: true, workerDispatch: true, isCurrent: true },
  { contactId: 'CONTACT-92', name: 'Lin Wei', channel: 'whatsapp', address: '+8613800138000', verificationStatus: 'VERIFIED', active: true, usable: true, workerDispatch: true, isCurrent: false },
  { contactId: 'CONTACT-93', name: 'Форма на сайте', channel: 'web_form', address: 'https://qingdao-nova.example/rfq', verificationStatus: 'UNVERIFIED', active: true, usable: true, workerDispatch: false, isCurrent: false },
]

/** The quotation the demonstration reply produced, tied to that reply. */
export const negotiationQuotes = [
  {
    responseId: 'RESP-1042-01', revision: 2, isLatest: true, communicationId: 'MSG-2',
    channel: 'email', receivedAt: ago(9), completeness: 'NEEDS_CLARIFICATION',
    productIdentityStatus: 'MATCHED', conflictingFields: [], missingFields: ['payment_terms'],
    fields: [
      { key: 'price', label: 'Цена', value: '1 240 USD/MT', status: 'PRESENT' },
      { key: 'quoted_quantity', label: 'Количество', value: '20 MT', status: 'PRESENT' },
      { key: 'moq', label: 'MOQ', value: '18 MT', status: 'PRESENT' },
      { key: 'incoterm', label: 'Базис', value: 'FCA Shanghai', status: 'PRESENT' },
      { key: 'lead_time', label: 'Срок', value: null, status: 'UNKNOWN' },
      { key: 'payment_terms', label: 'Оплата', value: null, status: 'UNKNOWN' },
      { key: 'purity', label: 'Чистота', value: '99.5%', status: 'PRESENT' },
      { key: 'grade', label: 'Грейд', value: 'Industrial', status: 'PRESENT' },
      { key: 'manufacturer', label: 'Производитель', value: null, status: 'UNKNOWN' },
      { key: 'offered_product', label: 'Предложено', value: '1,3-бутадиен', status: 'PRESENT' },
      { key: 'sample_available', label: 'Образец', value: null, status: 'UNKNOWN' },
    ],
  },
]

export const proposals = [
  { id: 'RESP-1042-01', cardId: 1042, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, supplierWebsite: 'https://qingdao-nova.example/', revision: 2, completeness: 'NEEDS_CLARIFICATION', productIdentityStatus: 'MATCHED', price: '1 240', currency: 'USD', priceUnit: 'MT', quantity: '20 MT', moq: '18 MT', incoterm: 'FCA', namedPlace: 'Shanghai', leadTime: undefined, paymentTerms: undefined, grade: 'Industrial', purity: '99.5%', coa: 'CLAIMED_AVAILABLE', tds: 'UNKNOWN', sds: 'CLAIMED_ATTACHED', sampleAvailable: undefined, fieldStates: { price: 'PRESENT', leadTime: 'UNKNOWN', paymentTerms: 'UNKNOWN', coa: 'PRESENT', tds: 'UNKNOWN', sampleAvailable: 'UNKNOWN' }, originalValues: { price: 'USD 1240 per metric ton', incoterm: 'FCA Shanghai' }, warnings: ['Не подтверждены условия оплаты', 'Не указан срок поставки'], updatedAt: ago(8) },
  { id: 'RESP-1042-02', cardId: 1042, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, supplierWebsite: 'https://meridian-materials.example/', revision: 1, completeness: 'NEEDS_HUMAN_REVIEW', productIdentityStatus: 'UNVERIFIED', price: '1 310', currency: 'USD', priceUnit: 'MT', quantity: '20 MT', moq: '20 MT', incoterm: 'CIP', namedPlace: 'Moscow', leadTime: '28–35 days', paymentTerms: '30% advance / 70% before shipment', grade: 'Polymerization grade', purity: '99.7%', coa: 'PROVIDED', tds: 'PROVIDED', sds: 'PROVIDED', sampleAvailable: 'Available', fieldStates: { price: 'PRESENT', leadTime: 'PRESENT', paymentTerms: 'PRESENT', coa: 'PRESENT', tds: 'PRESENT', sampleAvailable: 'PRESENT' }, originalValues: { price: 'USD 1,310/MT', leadTime: '4-5 weeks after deposit' }, warnings: ['CAS не указан в ответе поставщика: идентичность продукта требует проверки'], updatedAt: ago(3) },
  { id: 'RESP-1042-03', cardId: 1042, supplierName: 'Fixture Industrial Trading', revision: 3, completeness: 'CONFLICTING', productIdentityStatus: 'MISMATCH', price: '1 180', currency: 'USD', priceUnit: 'MT', quantity: '20 MT', moq: '10 MT', incoterm: 'EXW', namedPlace: 'Ningbo', leadTime: '21 days', paymentTerms: 'T/T', grade: 'Industrial', purity: '99%', coa: 'CLAIMED_ATTACHED', tds: 'UNKNOWN', sds: 'UNKNOWN', fieldStates: { price: 'PRESENT', purity: 'CONFLICT', coa: 'AMBIGUOUS', tds: 'UNKNOWN' }, originalValues: { purity: '99% min / 99.5% typical' }, warnings: ['Предложенная чистота противоречива', 'Идентичность продукта не совпадает с запросом'], updatedAt: ago(2) },
]

export const escalations = [
  { id: 'ESC-1042-77', cardId: 1042, negotiationId: 'NEG-1042-B2', cardTitle: cards[0].title, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, contactId: 'CONTACT-27', status: 'OPEN', priority: 88, title: 'Не подтверждена идентичность продукта', recommendation: 'Сверить CAS и спецификацию до продолжения переговоров.', risks: [{ category: 'PRODUCT_IDENTITY', code: 'product_identity_unverified', reason: 'В ответе поставщика нет CAS-номера.', evidence: ['We can offer polymerization grade material.'] }], assignedTo: 'Мария Соколова', createdAt: ago(3), updatedAt: ago(2) },
  { id: 'ESC-1038-12', cardId: 1038, cardTitle: cards[1].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, status: 'IN_REVIEW', priority: 72, title: 'Требуется выбор аналога и грейда', recommendation: 'Специалисту сопоставить техническую спецификацию с областью применения.', risks: [{ category: 'GRADE_SELECTION', code: 'grade_ambiguity', reason: 'Найдено несколько несовпадающих силиконовых формул.', evidence: [] }], assignedTo: 'Алексей Орлов', createdAt: ago(22), updatedAt: ago(4) },
]

export const activity = [
  { id: 'ACT-1', type: 'supplier_response', level: 'success', title: 'Ответ поставщика обработан', description: 'Обновлено предложение RESP-1042-01, ревизия 2.', entityType: 'proposal', entityId: 'RESP-1042-01', cardId: 1042, createdAt: ago(1) },
  { id: 'ACT-2', type: 'attachment_failure', level: 'error', title: 'Не удалось обработать вложение', description: 'Файл с паспортом качества не распознан. Автоматическая повторная попытка завершилась ошибкой.', entityType: 'negotiation', entityId: 'NEG-1042-B2', cardId: 1042, retryStatus: 'FAILED_FINAL', diagnostic: 'attachment_ingestion: unsupported embedded image encoding', createdAt: ago(2) },
  { id: 'ACT-3', type: 'escalation', level: 'warning', title: 'Создана эскалация', description: 'Идентичность продукта требует проверки специалистом.', entityType: 'escalation', entityId: 'ESC-1042-77', cardId: 1042, createdAt: ago(3) },
  { id: 'ACT-4', type: 'message_failure', level: 'error', title: 'RFQ не доставлен', description: 'Почтовый шлюз отклонил сообщение. Следующая попытка не запланирована.', entityType: 'negotiation', entityId: 'NEG-1024-A3', cardId: 1024, retryStatus: 'FAILED_FINAL', diagnostic: 'smtp: 550 recipient rejected', createdAt: ago(13) },
  { id: 'ACT-5', type: 'normalization', level: 'warning', title: 'Вещество требует ручной проверки', description: 'CAS и название дают неоднозначное соответствие.', entityType: 'card', entityId: '1038', cardId: 1038, createdAt: ago(18) },
]

export function overviewFixture() {
  return {
    kpis: { activeCards: 4, waitingSupplier: 2, needsSpecialist: 3, readyProposals: 1, failures: 2 },
    stages: [
      { id: 'SOURCING', label: 'Поиск и проверка', count: 1, cards: cards.filter(item => item.stage === 'SOURCING') },
      { id: 'NEGOTIATION', label: 'Переговоры', count: 2, cards: cards.filter(item => ['NEGOTIATION', 'WAITING_SUPPLIER'].includes(item.stage)) },
      { id: 'COMPARISON', label: 'Сравнение', count: 1, cards: cards.filter(item => item.stage === 'COMPARISON') },
    ],
    attention: escalations,
    recentActivity: activity.slice(0, 4),
  }
}

export const playbookItems = [
  { itemId: 'PB-DEMO-DIR-1', kind: 'DIRECTIVE', title: 'Не раскрывать целевую цену и объём потребности', body: 'Не называй поставщику ориентир цены и целевой годовой объём из карточки закупки.', language: 'any', topic: null, scope: { cardIds: [], supplierIds: [], countries: [], channels: [], stages: [], specificity: 0 }, forbidsDisclosure: ['TARGET_PRICE'], verbatim: false, enabled: true, version: 1, provenance: 'DEFAULT', needsCustomerReview: false, history: [] },
  { itemId: 'PB-DEMO-DIR-2', kind: 'DIRECTIVE', title: 'Китай: экспортная лицензия', body: 'Если поставщик находится в Китае, уточни наличие экспортной лицензии на это вещество.', language: 'any', topic: null, scope: { cardIds: [], supplierIds: [], countries: ['CN'], channels: [], stages: [], specificity: 1 }, forbidsDisclosure: [], verbatim: false, enabled: true, version: 2, provenance: 'DEFAULT', needsCustomerReview: false, history: [] },
  { itemId: 'PB-DEMO-BLK-1', kind: 'BLOCK', title: 'Ответ о применении вещества', body: '[ТРЕБУЕТ ЗАПОЛНЕНИЯ ЗАКАЗЧИКОМ] Укажите, что сообщать поставщику о применении.', language: 'any', topic: 'APPLICATION', scope: { cardIds: [], supplierIds: [], countries: [], channels: [], stages: [], specificity: 0 }, forbidsDisclosure: [], verbatim: false, enabled: true, version: 1, provenance: 'DEFAULT', needsCustomerReview: true, history: [] },
  { itemId: 'PB-DEMO-LCK-1', kind: 'LOCKED_CLAUSE', title: 'Точный CAS без замены', body: 'Please quote this exact CAS: a different product, grade or concentration is not a substitute without written approval.', language: 'en', topic: null, scope: { cardIds: [], supplierIds: [], countries: [], channels: [], stages: ['FIRST_CONTACT'], specificity: 1 }, forbidsDisclosure: [], verbatim: true, enabled: true, version: 1, provenance: 'DEFAULT', needsCustomerReview: false, history: [] },
]

export const compositions = [
  { compositionId: 'CMP-DEMO-1', assignmentId: 'NEG-1042-B2', cardId: 1042, supplierId: 'SUP-B72D', contactId: 'CONTACT-27', channel: 'email', language: 'en', stage: 'CLARIFICATION', trigger: 'INBOUND_MESSAGE', reviewMode: 'DRAFT_FIRST', status: 'DRAFT', appliedItems: [{ itemId: 'PB-DEMO-DIR-1', kind: 'DIRECTIVE', title: 'Не раскрывать целевую цену и объём потребности', version: 1, topic: null, reason: 'Действует для всех сообщений.' }, { itemId: 'PB-DEMO-DIR-2', kind: 'DIRECTIVE', title: 'Китай: экспортная лицензия', version: 2, topic: null, reason: 'Правило задано для стран: CN.' }], detectedTopics: ['DOCUMENTS', 'DELIVERY_TERMS'], missingFields: ['coa', 'incoterm'], withheld: ['TARGET_PRICE'], checks: [{ check: 'NOT_EMPTY', status: 'PASSED', detail: 'Черновик содержит текст.' }, { check: 'LOCKED_CLAUSES_PRESENT', status: 'SKIPPED', detail: 'Для этой стадии обязательные формулировки не заданы.' }, { check: 'NO_FORBIDDEN_DISCLOSURE', status: 'PASSED', detail: 'Закрытые данные карточки не раскрыты: TARGET_PRICE' }, { check: 'NO_UNFILLED_PLACEHOLDER', status: 'PASSED', detail: 'Незаполненных шаблонных маркеров нет.' }], draftText: 'Thank you for the quotation.\n\nCould you please confirm:\n1. The delivery basis you can offer and the lead time.\n2. Whether a recent CoA can be provided before shipment.\n\nWe also need confirmation of your export licence for this substance.', editedText: null, draftSha256: 'a'.repeat(64), sourceResponseId: 'RESP-1042-02', sourceCommunicationId: null, communicationId: null, wasEdited: false, createdAt: ago(2), decidedAt: null, decidedByPrincipalKey: null, decisionNote: null },
  { compositionId: 'CMP-DEMO-2', assignmentId: 'NEG-1042-A1', cardId: 1042, supplierId: 'SUP-A19F', contactId: 'CONTACT-11', channel: 'email', language: 'en', stage: 'FIRST_CONTACT', trigger: 'FIRST_CONTACT', reviewMode: 'AUTO', status: 'SENT', appliedItems: [{ itemId: 'PB-DEMO-LCK-1', kind: 'LOCKED_CLAUSE', title: 'Точный CAS без замены', version: 1, topic: null, reason: 'Правило задано для стадии FIRST_CONTACT.' }], detectedTopics: [], missingFields: [], withheld: [], checks: [{ check: 'LOCKED_CLAUSES_PRESENT', status: 'PASSED', detail: 'Все обязательные формулировки присутствуют дословно: Точный CAS без замены' }], draftText: 'Hello,\n\nWe are looking for Acetone (CAS 67-64-1), 20 MT.\n\nPlease quote this exact CAS: a different product, grade or concentration is not a substitute without written approval.', editedText: null, draftSha256: 'b'.repeat(64), sourceResponseId: null, sourceCommunicationId: null, communicationId: 'COMM-DEMO-9', wasEdited: false, createdAt: ago(30), decidedAt: ago(30), decidedByPrincipalKey: 'USER:demo', decisionNote: null },
]

export function playbookVocabularyFixture() {
  return {
    kinds: ['DIRECTIVE', 'BLOCK', 'LOCKED_CLAUSE'],
    topics: ['APPLICATION', 'VOLUME', 'GRADE', 'DOCUMENTS', 'DELIVERY_TERMS', 'SAMPLE', 'PAYMENT', 'COMPANY'],
    stages: ['FIRST_CONTACT', 'CLARIFICATION', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSING'],
    disclosureGuards: ['TARGET_PRICE', 'TARGET_VOLUME', 'APPLICATION_AREA', 'SPECIALIST_COMMENTS'],
    languages: ['any', 'ru', 'en'],
  }
}

export function playbookFixture(filters = {}) {
  const items = playbookItems.filter(item => !filters.kind || item.kind === filters.kind)
  return {
    items,
    counts: { DIRECTIVE: 2, BLOCK: 1, LOCKED_CLAUSE: 1 },
    needsCustomerReview: playbookItems.filter(item => item.needsCustomerReview).length,
  }
}

export function playbookItemFixture(itemId) {
  const item = playbookItems.find(entry => entry.itemId === itemId)
  return item ? { ...item, usageCount: 3 } : null
}

export function compositionsFixture(filters = {}) {
  return {
    compositions: compositions.filter(item =>
      (!filters.status || item.status === filters.status) &&
      (!filters.assignmentId || item.assignmentId === filters.assignmentId)),
    hasMore: false,
  }
}

export function compositionFixture(compositionId) {
  return compositions.find(item => item.compositionId === compositionId) || null
}

export function negotiationActivityFixture() {
  return {
    generatedAt: ago(0),
    counts: { queued: 2, active: 1, waitingSupplier: 2, followUpDue: 1, ready: 1, escalated: 1, stale: 0, complete: 3, dueNow: 1, quarantine: 1, awaitingReview: 1 },
    dueNow: [{ id: 'NEG-1042-B2', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, channel: 'email', status: 'FOLLOW_UP_DUE', nextActionAt: ago(1) }],
    scheduled: [{ id: 'NEG-1042-A1', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, channel: 'email', status: 'WAITING_SUPPLIER', nextActionAt: ago(-20) }],
    stuck: [{ id: 'NEG-1024-A3', cardId: 1024, cardTitle: cards[2]?.title || 'Карточка #1024', supplierId: 'SUP-A19F', supplierName: suppliers[0].name, channel: 'email', status: 'ESCALATED', lastWorkerError: 'smtp: 550 recipient rejected', escalationReason: 'Черновик сообщения отклонён специалистом' }],
    quarantine: [{ id: 'UNASSIGNED-DEMO-1', channel: 'email', address: 'sales@unknown-trading.example', bridgeJid: 'procurement-email4@procurementassistant.x.h9y.localhost', conversationId: null, externalMessageId: 'demo-1', subject: 'Acetone 99.5% — quotation', text: 'Dear Sir, we can supply acetone at competitive price. Please advise your requirement.', attachmentUrls: [], status: 'NEEDS_IDENTIFICATION', resolvedAssignmentId: null, dismissalReason: null, createdAt: ago(5) }],
    quarantineTotal: 1,
  }
}

export function quarantineFixture(filters = {}) {
  const all = negotiationActivityFixture().quarantine
  return {
    messages: all.filter(item => !filters.channel || item.channel === filters.channel),
    status: filters.status || 'NEEDS_IDENTIFICATION',
  }
}
