import axios from 'axios'

import { adaptPage, adaptSupplier } from '../adapters'
import { fixturePage, fixtures, mutation, read } from '../devMode'
import { id, procurementUrl, request } from '../http'

export const supplierEndpoints = {
  suppliers: read(
    async (filters = {}, signal) =>
      adaptPage(await request('/suppliers', { params: filters, signal }), adaptSupplier),
    async (filters = {}) => fixturePage(
      (await fixtures()).suppliers.map(adaptSupplier), filters,
      ['id', 'name', 'country', 'contacts'],
    ),
  ),
  supplier: read(
    async (supplierId, signal) => {
      const response = await request(`/suppliers/${id(supplierId)}`, { signal })
      return { ...response, supplier: adaptSupplier(response.supplier) }
    },
    async supplierId => {
      const fixture = await fixtures()
      const supplier = fixture.suppliers.map(adaptSupplier).find(item => item.id === supplierId)
      if (!supplier) return null
      return {
        supplier,
        negotiations: fixture.negotiations.filter(item => item.supplierId === supplierId),
        proposals: fixture.proposals.filter(item => item.supplierId === supplierId),
        communications: fixture.messages,
      }
    },
  ),
  createSupplier: mutation(async payload =>
    adaptSupplier(await request('/suppliers', { method: 'post', data: payload }))),
  addSupplierCapability: mutation(async (supplierId, payload) =>
    adaptSupplier(await request(`/suppliers/${id(supplierId)}/capabilities`, { method: 'post', data: payload }))),
  addSupplierContact: mutation(async (supplierId, payload) =>
    adaptSupplier(await request(`/suppliers/${id(supplierId)}/contacts`, { method: 'post', data: payload }))),
  updateSupplierContact: mutation(async (supplierId, contactId, payload) =>
    adaptSupplier(await request(
      `/suppliers/${id(supplierId)}/contacts/${id(contactId)}`, { method: 'patch', data: payload },
    ))),
  updateSupplierProfile: mutation(async (supplierId, payload) =>
    adaptSupplier(await request(`/suppliers/${id(supplierId)}`, { method: 'patch', data: payload }))),
  updateSupplierQualification: mutation(async (supplierId, qualificationStatus) =>
    adaptSupplier(await request(`/suppliers/${id(supplierId)}/qualification`, {
      method: 'patch', data: { qualification_status: qualificationStatus },
    }))),
}

export const negotiationEndpoints = {
  negotiations: read(
    async (filters = {}, signal) => adaptPage(await request('/negotiations', { params: filters, signal })),
    async (filters = {}) => fixturePage(
      (await fixtures()).negotiations, filters,
      ['id', 'cardId', 'cardTitle', 'supplierId', 'supplierName', 'contactId', 'contactName', 'channel'],
    ),
  ),
  negotiation: read(
    (negotiationId, signal) => request(`/negotiations/${id(negotiationId)}`, { signal }),
    async negotiationId => {
      const fixture = await fixtures()
      const negotiation = fixture.negotiations.find(item => item.id === negotiationId)
      if (!negotiation) return null
      return {
        ...negotiation,
        messages: fixture.messages,
        proposal: fixture.proposals.find(item =>
          item.cardId === negotiation.cardId && item.supplierId === negotiation.supplierId),
      }
    },
  ),
  createNegotiation: mutation(payload => request('/negotiations', { method: 'post', data: payload })),
  queueNegotiation: mutation((negotiationId, payload) =>
    request(`/negotiations/${id(negotiationId)}/queue`, { method: 'post', data: payload })),
  scheduleNegotiationFollowUp: mutation((negotiationId, when) =>
    request(`/negotiations/${id(negotiationId)}/follow-up`, { method: 'post', data: { when } })),
  ingestSupplierResponse: mutation((negotiationId, payload) =>
    request(`/negotiations/${id(negotiationId)}/responses`, { method: 'post', data: payload })),
}

export const proposalEndpoints = {
  proposals: read(
    async (filters = {}, signal) => adaptPage(await request('/proposals', { params: filters, signal })),
    async (filters = {}) => fixturePage(
      (await fixtures()).proposals, filters, ['id', 'supplierName', 'currency', 'incoterm'],
    ),
  ),
  proposal: read(
    (responseId, signal) => request(`/proposals/${id(responseId)}`, { signal }),
    async responseId => (await fixtures()).proposals.find(item => item.id === responseId) || null,
  ),
  comparison: read(
    (cardId, signal) => request('/proposals/compare', { params: { cardId }, signal }),
    async cardId => ({
      cardId: Number(cardId),
      rows: (await fixtures()).proposals.filter(item => String(item.cardId) === String(cardId)),
      decisionNote: 'Сравнение носит описательный характер. Итоговое решение принимает специалист по закупкам.',
    }),
  ),
  prepareSupplierClarification: mutation((responseId, language) =>
    request(`/proposals/${id(responseId)}/clarification`, { method: 'post', data: { language } })),
  // Not routed through `request`: the export is a file download, so it needs a
  // blob response and its own short timeout rather than the JSON pipeline.
  exportSupplierComparison: mutation(async (cardId, language = 'ru') => {
    const response = await axios.get(procurementUrl('/proposals/export'), {
      params: { cardId, language }, withCredentials: true, responseType: 'blob', timeout: 30000,
    })
    const disposition = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ||
      `supplier-comparison-card-${cardId}-${language}.csv`
    return { blob: response.data, filename }
  }),
  supplierAttachmentUrl(attachmentId) {
    return procurementUrl(`/supplier-response-attachments/${id(attachmentId)}`)
  },
}

export const escalationEndpoints = {
  escalations: read(
    async (filters = {}, signal) => adaptPage(await request('/escalations', { params: filters, signal })),
    async (filters = {}) => fixturePage(
      (await fixtures()).escalations, filters,
      ['id', 'title', 'cardId', 'cardTitle', 'supplierId', 'supplierName',
       'negotiationId', 'proposalId', 'assignedTo'],
    ),
  ),
  escalation: read(
    (escalationId, signal) => request(`/escalations/${id(escalationId)}`, { signal }),
    async escalationId => (await fixtures()).escalations.find(item => item.id === escalationId) || null,
  ),
  claimEscalation: mutation(escalationId =>
    request(`/escalations/${id(escalationId)}/claim`, { method: 'post' })),
  recommendEscalation: mutation((escalationId, payload) =>
    request(`/escalations/${id(escalationId)}/recommendations`, { method: 'post', data: payload })),
  resolveEscalation: mutation((escalationId, payload) =>
    request(`/escalations/${id(escalationId)}/resolution`, { method: 'post', data: payload })),
}
