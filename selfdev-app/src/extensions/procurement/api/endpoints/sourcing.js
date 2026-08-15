import { adaptSupplier } from '../adapters'
import { fixtures, mutation, read } from '../devMode'
import { id, request } from '../http'

export const echemiEndpoints = {
  echemi: mutation((cardId, signal) => request(`/cards/${id(cardId)}/echemi`, { signal })),
  echemiBrowserAccess: mutation((cardId, signal) =>
    request(`/cards/${id(cardId)}/echemi/browser-access`, { signal })),
  searchEchemi: mutation(cardId =>
    request(`/cards/${id(cardId)}/echemi/search`, { method: 'post' })),
  registerEchemiSeller: mutation((cardId, productId) =>
    request(`/cards/${id(cardId)}/echemi/listings/${id(productId)}/supplier`, { method: 'post' })),
  prepareEchemiInquiry: mutation((cardId, payload) =>
    request(`/cards/${id(cardId)}/echemi/inquiries`, { method: 'post', data: payload })),
  previewEchemiInquiry: mutation((cardId, inquiryId) =>
    request(`/cards/${id(cardId)}/echemi/inquiries/${id(inquiryId)}/preview`, { method: 'post' })),
  approveEchemiInquiry: mutation((cardId, inquiryId) =>
    request(`/cards/${id(cardId)}/echemi/inquiries/${id(inquiryId)}/approve`, { method: 'post' })),
  submitEchemiInquiry: mutation((cardId, inquiryId) =>
    request(`/cards/${id(cardId)}/echemi/inquiries/${id(inquiryId)}/submit`, { method: 'post' })),
}

export const sourcingEndpoints = {
  sourcing: read(
    async (cardId, signal) => {
      try {
        return await request(`/cards/${id(cardId)}/sourcing`, { signal })
      } catch (error) {
        // A card that was never researched is a normal state, not a failure.
        if (error.response?.status === 404 && error.response?.data?.code === 'NOT_FOUND') return null
        throw error
      }
    },
    async cardId => (await fixtures()).sourcingFixtureForCard(cardId),
  ),
  sourcingRun: read(
    (runId, signal) => request(`/sourcing/${id(runId)}`, { signal }),
    async runId => (await fixtures()).sourcingFixtureById(runId),
  ),
  sourcingEngines: read(
    signal => request('/sourcing/engines', { signal }),
    async () => (await fixtures()).sourcingEngines,
  ),
  sourcingQueryTemplates: read(
    signal => request('/sourcing/query-templates', { signal }),
    async () => (await fixtures()).sourcingQueryTemplates,
  ),
  startSourcing: mutation((cardId, maxResults = 20, queryTemplateIds, engineIds) =>
    request(`/cards/${id(cardId)}/sourcing/runs`, {
      method: 'post',
      data: {
        maxResults,
        ...(queryTemplateIds ? { queryTemplateIds } : {}),
        ...(engineIds ? { engineIds } : {}),
      },
    })),
  cancelSourcing: mutation(runId => request(`/sourcing/${id(runId)}/cancel`, { method: 'post' })),
  retrySourcingSource: mutation((runId, sourceId) =>
    request(`/sourcing/${id(runId)}/sources/${id(sourceId)}/retry`, { method: 'post' })),
  saveSourcingQueryTemplates: mutation(templates =>
    request('/sourcing/query-templates', { method: 'put', data: { templates } })),
  addSourcingSource: mutation((runId, url) =>
    request(`/sourcing/${id(runId)}/sources`, { method: 'post', data: { url } })),
  reviewSourcingCandidate: mutation((runId, candidateId, payload) =>
    request(`/sourcing/${id(runId)}/candidates/${id(candidateId)}/review`, { method: 'post', data: payload })),
  promoteSourcingCandidate: mutation(async (runId, candidateId) =>
    adaptSupplier(await request(
      `/sourcing/${id(runId)}/candidates/${id(candidateId)}/promote`, { method: 'post' },
    ))),
}

export const webFormEndpoints = {
  webFormAdapters: read(
    signal => request('/web-form/adapters', { signal }),
    async () => ({ adapters: [] }),
  ),
  negotiationWebForm: read(
    (negotiationId, signal) => request(`/negotiations/${id(negotiationId)}/web-form`, { signal }),
    async negotiationId => ({ negotiationId, channel: null, request: null }),
  ),
  prepareNegotiationWebForm: mutation((negotiationId, payload) =>
    request(`/negotiations/${id(negotiationId)}/web-form/prepare`, { method: 'post', data: payload })),
  previewNegotiationWebForm: mutation(negotiationId =>
    request(`/negotiations/${id(negotiationId)}/web-form/preview`, { method: 'post' })),
  approveNegotiationWebForm: mutation((negotiationId, fingerprint) =>
    request(`/negotiations/${id(negotiationId)}/web-form/approve`, { method: 'post', data: { fingerprint } })),
  submitNegotiationWebForm: mutation(negotiationId =>
    request(`/negotiations/${id(negotiationId)}/web-form/submit`, { method: 'post' })),
}
