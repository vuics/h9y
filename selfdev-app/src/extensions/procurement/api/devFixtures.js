const ago = hours => new Date(Date.now() - hours * 3600000).toISOString()

export const cards = [
  { id: 1042, title: '1,3-бутадиен — промышленная партия', substanceName: '1,3-Butadiene', casNumber: '106-99-0', purity: '≥ 99.5%', targetVolume: '20 MT', stage: 'NEGOTIATION', rfqStatus: 'APPROVED', normalizationStatus: 'NORMALIZED', completeness: 'NEEDS_CLARIFICATION', supplierCount: 4, proposalCount: 3, updatedAt: ago(1) },
  { id: 1038, title: 'Силиконовый модификатор для косметики', substanceName: 'Silicone modifier', casNumber: '63148-62-9', purity: 'Cosmetic grade', targetVolume: '2 MT', stage: 'SOURCING', rfqStatus: 'AWAITING_APPROVAL', normalizationStatus: 'NEEDS_REVIEW', completeness: 'NEEDS_HUMAN_REVIEW', supplierCount: 7, proposalCount: 1, updatedAt: ago(4) },
  { id: 1031, title: 'Бензол, аналитический стандарт', substanceName: 'Benzene', casNumber: '71-43-2', purity: '≥ 99.9%', targetVolume: '25 KG', stage: 'COMPARISON', rfqStatus: 'APPROVED', normalizationStatus: 'NORMALIZED', completeness: 'COMPLETE', supplierCount: 3, proposalCount: 3, updatedAt: ago(9) },
  { id: 1024, title: 'Формальдегид 37%', substanceName: 'Formaldehyde solution', casNumber: '50-00-0', purity: '37%', targetVolume: '5 MT', stage: 'WAITING_SUPPLIER', rfqStatus: 'APPROVED', normalizationStatus: 'NORMALIZED', completeness: 'NEEDS_CLARIFICATION', supplierCount: 5, proposalCount: 2, updatedAt: ago(27) },
]

export const suppliers = [
  { id: 'SUP-A19F', name: 'Qingdao Nova Chemical Co.', country: 'CN', qualificationStatus: 'UNDER_REVIEW', contacts: [{ id: 'CONTACT-91', name: 'Lin Wei', role: 'Export manager', channel: 'email', address: 'lin.wei@fixture.invalid', verificationStatus: 'VERIFIED', active: true }], capabilities: [{ casNumber: '106-99-0', productName: '1,3-Butadiene', verificationStatus: 'CLAIMED', source: 'ECHEMI_MARKETPLACE_LISTING', sourceUrl: 'https://example.invalid/source/1' }], updatedAt: ago(1) },
  { id: 'SUP-B72D', name: 'Jiangsu Meridian Materials', country: 'CN', qualificationStatus: 'QUALIFIED', contacts: [{ id: 'CONTACT-27', name: 'Mei Chen', role: 'International sales', channel: 'whatsapp', address: '+86 •••• 1842', verificationStatus: 'VERIFIED', active: true }], capabilities: [{ casNumber: '106-99-0', productName: 'Butadiene, polymerization grade', verificationStatus: 'VERIFIED', source: 'OFFICIAL_CATALOGUE', sourceUrl: 'https://example.invalid/source/2' }], updatedAt: ago(3) },
  { id: 'SUP-C11A', name: 'Arclight Fine Chemicals', country: 'DE', qualificationStatus: 'UNVERIFIED', contacts: [{ id: 'CONTACT-33', name: 'Sofia Klein', role: 'Sales', channel: 'email', address: 'sofia.klein@fixture.invalid', verificationStatus: 'UNVERIFIED', active: true }], capabilities: [{ casNumber: '71-43-2', productName: 'Benzene analytical standard', verificationStatus: 'CLAIMED', source: 'MANUAL' }], updatedAt: ago(16) },
]

export const negotiations = [
  { id: 'NEG-1042-A1', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, contactId: 'CONTACT-91', contactName: 'Lin Wei', channel: 'email', status: 'WAITING_SUPPLIER', nextAction: 'FOLLOW_UP', nextActionAt: ago(-18), lastDispatchStatus: 'DELIVERED', requiresHuman: false, updatedAt: ago(7) },
  { id: 'NEG-1042-B2', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, contactId: 'CONTACT-27', contactName: 'Mei Chen', channel: 'whatsapp', status: 'ESCALATED', nextAction: 'FOLLOW_UP', lastDispatchStatus: 'DELIVERED', requiresHuman: true, updatedAt: ago(2) },
  { id: 'NEG-1024-A3', cardId: 1024, cardTitle: cards[3].title, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, contactId: 'CONTACT-91', contactName: 'Lin Wei', channel: 'email', status: 'FAILED', nextAction: 'SEND_INITIAL_RFQ', lastDispatchStatus: 'FAILED', lastWorkerError: 'Почтовый шлюз отклонил сообщение после последней попытки.', requiresHuman: true, updatedAt: ago(13) },
]

export const messages = [
  { id: 'MSG-1', kind: 'system_outbound', author: 'Procurement Agent', text: 'RFQ-1042 отправлен: запрошены цена, MOQ, CoA/TDS, сроки и условия оплаты.', createdAt: ago(30), status: 'DELIVERED' },
  { id: 'MSG-2', kind: 'supplier', author: 'Lin Wei', text: 'Предлагаем 1,3-бутадиен 99,5%. Цена — 1 240 USD/MT, FCA Shanghai. MOQ 18 MT.', createdAt: ago(9), status: 'RECEIVED' },
  { id: 'MSG-3', kind: 'interpretation', author: 'Supplier Response Intelligence', text: 'Извлечены цена, валюта, базис и MOQ. Не подтверждены CoA, TDS, срок поставки и условия оплаты.', createdAt: ago(8), status: 'PROCESSED' },
  { id: 'MSG-4', kind: 'human', author: 'Специалист закупок', text: 'Проверить, входит ли экспортное оформление в FCA, и запросить образец.', createdAt: ago(6), status: 'RECORDED' },
]

export const proposals = [
  { id: 'RESP-1042-01', cardId: 1042, supplierId: 'SUP-A19F', supplierName: suppliers[0].name, revision: 2, completeness: 'NEEDS_CLARIFICATION', productIdentityStatus: 'MATCHED', price: '1 240', currency: 'USD', priceUnit: 'MT', quantity: '20 MT', moq: '18 MT', incoterm: 'FCA', namedPlace: 'Shanghai', leadTime: undefined, paymentTerms: undefined, grade: 'Industrial', purity: '99.5%', coa: 'CLAIMED_AVAILABLE', tds: 'UNKNOWN', sds: 'CLAIMED_ATTACHED', sampleAvailable: undefined, fieldStates: { price: 'PRESENT', leadTime: 'UNKNOWN', paymentTerms: 'UNKNOWN', coa: 'PRESENT', tds: 'UNKNOWN', sampleAvailable: 'UNKNOWN' }, originalValues: { price: 'USD 1240 per metric ton', incoterm: 'FCA Shanghai' }, warnings: ['Не подтверждены условия оплаты', 'Не указан срок поставки'], updatedAt: ago(8) },
  { id: 'RESP-1042-02', cardId: 1042, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, revision: 1, completeness: 'NEEDS_HUMAN_REVIEW', productIdentityStatus: 'UNVERIFIED', price: '1 310', currency: 'USD', priceUnit: 'MT', quantity: '20 MT', moq: '20 MT', incoterm: 'CIP', namedPlace: 'Moscow', leadTime: '28–35 days', paymentTerms: '30% advance / 70% before shipment', grade: 'Polymerization grade', purity: '99.7%', coa: 'PROVIDED', tds: 'PROVIDED', sds: 'PROVIDED', sampleAvailable: 'Available', fieldStates: { price: 'PRESENT', leadTime: 'PRESENT', paymentTerms: 'PRESENT', coa: 'PRESENT', tds: 'PRESENT', sampleAvailable: 'PRESENT' }, originalValues: { price: 'USD 1,310/MT', leadTime: '4-5 weeks after deposit' }, warnings: ['CAS не указан в ответе поставщика: идентичность продукта требует проверки'], updatedAt: ago(3) },
  { id: 'RESP-1042-03', cardId: 1042, supplierName: 'Fixture Industrial Trading', revision: 3, completeness: 'CONFLICTING', productIdentityStatus: 'MISMATCH', price: '1 180', currency: 'USD', priceUnit: 'MT', quantity: '20 MT', moq: '10 MT', incoterm: 'EXW', namedPlace: 'Ningbo', leadTime: '21 days', paymentTerms: 'T/T', grade: 'Industrial', purity: '99%', coa: 'CLAIMED_ATTACHED', tds: 'UNKNOWN', sds: 'UNKNOWN', fieldStates: { price: 'PRESENT', purity: 'CONFLICT', coa: 'AMBIGUOUS', tds: 'UNKNOWN' }, originalValues: { purity: '99% min / 99.5% typical' }, warnings: ['Предложенная чистота противоречива', 'Идентичность продукта не совпадает с запросом'], updatedAt: ago(2) },
]

export const escalations = [
  { id: 'ESC-1042-77', cardId: 1042, cardTitle: cards[0].title, supplierId: 'SUP-B72D', supplierName: suppliers[1].name, contactId: 'CONTACT-27', status: 'OPEN', priority: 88, title: 'Не подтверждена идентичность продукта', recommendation: 'Сверить CAS и спецификацию до продолжения переговоров.', risks: [{ category: 'PRODUCT_IDENTITY', code: 'product_identity_unverified', reason: 'В ответе поставщика нет CAS-номера.', evidence: ['We can offer polymerization grade material.'] }], assignedTo: 'Мария Соколова', createdAt: ago(3), updatedAt: ago(2) },
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
