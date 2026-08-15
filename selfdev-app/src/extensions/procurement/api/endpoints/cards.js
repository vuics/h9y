import { adaptCard, adaptPage, adaptRFQ } from '../adapters'
import { fixturePage, fixtures, mutation, read } from '../devMode'
import { id, request } from '../http'

export const cardEndpoints = {
  overview: read(
    ({ signal } = {}) => request('/overview', { signal }),
    async () => (await fixtures()).overviewFixture(),
  ),
  overviewBoard: read(
    ({ stage, page, pageSize } = {}, signal) =>
      request('/overview/board', { params: { stage, page, pageSize }, signal }),
    async () => ({ stages: [], truncated: false }),
  ),
  cards: read(
    async (filters = {}, signal) =>
      adaptPage(await request('/cards', { params: filters, signal }), adaptCard),
    async (filters = {}) => fixturePage(
      (await fixtures()).cards.map(adaptCard), filters,
      ['id', 'title', 'casNumber', 'substanceName'],
    ),
  ),
  card: read(
    async (cardId, signal) => adaptCard(await request(`/cards/${id(cardId)}`, { signal })),
    async cardId => (await fixtures()).cards.map(adaptCard)
      .find(item => String(item.id) === String(cardId)) || null,
  ),
  createCard: mutation(async payload =>
    adaptCard(await request('/cards', { method: 'post', data: payload }))),
  updateCard: mutation(async (cardId, payload) => {
    const response = await request(`/cards/${id(cardId)}`, { method: 'patch', data: payload })
    return { card: adaptCard(response.card), effects: response.effects }
  }),
  normalizeCard: mutation(async cardId =>
    adaptCard(await request(`/cards/${id(cardId)}/normalize`, { method: 'post' }))),
  activity: read(
    async (filters = {}, signal) => adaptPage(await request('/activity', { params: filters, signal })),
    async (filters = {}) => fixturePage(
      (await fixtures()).activity, filters,
      ['id', 'title', 'description', 'type', 'entityId', 'cardId'],
    ),
  ),
}

export const rfqEndpoints = {
  rfq: read(
    async (cardId, signal) => adaptRFQ(await request(`/cards/${id(cardId)}/rfq`, { signal })),
    async cardId => {
      const card = (await fixtures()).cards.map(adaptCard)
        .find(item => String(item.id) === String(cardId))
      if (!card) return null
      return adaptRFQ({
        cardId: card.id, cardTitle: card.title, cardStatus: card.status,
        status: card.rfqStatus || 'NOT_PREPARED', rfq: null,
      })
    },
  ),
  prepareRFQ: mutation(async cardId =>
    adaptRFQ(await request(`/cards/${id(cardId)}/rfq/prepare`, { method: 'post' }))),
  editRFQ: mutation(async (cardId, versions) =>
    adaptRFQ(await request(`/cards/${id(cardId)}/rfq`, { method: 'patch', data: versions }))),
  approveRFQ: mutation(async (cardId, documentFingerprint) =>
    adaptRFQ(await request(`/cards/${id(cardId)}/rfq/approve`, {
      method: 'post', data: { document_fingerprint: documentFingerprint },
    }))),
}

export const cardImportEndpoints = {
  cardImports: read(
    signal => request('/card-imports', { signal }),
    async () => ({ items: [] }),
  ),
  cardImport: mutation((importId, signal) => request(`/card-imports/${id(importId)}`, { signal })),
  createCardImport: mutation(payload => request('/card-imports', { method: 'post', data: payload })),
  updateCardImportMapping: mutation((importId, columns) =>
    request(`/card-imports/${id(importId)}/mapping`, { method: 'patch', data: { columns } })),
  confirmCardImport: mutation((importId, payload) =>
    request(`/card-imports/${id(importId)}/confirm`, { method: 'post', data: payload })),
  normalizeCardImport: mutation(importId =>
    request(`/card-imports/${id(importId)}/normalize`, { method: 'post' })),
  cancelCardImport: mutation(importId =>
    request(`/card-imports/${id(importId)}/cancel`, { method: 'post' })),
}
