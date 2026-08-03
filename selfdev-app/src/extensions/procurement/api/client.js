import axios from 'axios'

import conf from '../../../conf'
import { adaptCard, adaptPage, adaptSupplier } from './adapters'

const useDevFixtures = import.meta.env.DEV &&
  import.meta.env.VITE_PROCUREMENT_DEV_FIXTURES === 'true'

function compactParams(filters = {}) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) =>
    value !== '' && value != null,
  ))
}

async function request(path, { params, signal } = {}) {
  const response = await axios.get(`${conf.api.url}/procurement${path}`, {
    params: compactParams(params),
    withCredentials: true,
    signal,
    timeout: 15000,
  })
  return response.data
}

function matches(item, filters, keys) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('ru')
  if (search && !keys.some(key => JSON.stringify(item[key] ?? '').toLocaleLowerCase('ru').includes(search))) return false
  if (filters.status && ![item.status, item.stage, item.completeness, item.qualificationStatus].includes(filters.status)) return false
  if (filters.supplierId && item.supplierId !== filters.supplierId) return false
  if (filters.cardId && String(item.cardId ?? item.id) !== String(filters.cardId)) return false
  return true
}

function fixturePage(items, filters, keys) {
  const filtered = items.filter(item => matches(item, filters, keys))
  const page = Math.max(1, Number(filters.page || 1))
  const pageSize = Math.max(1, Number(filters.pageSize || 20))
  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length, hasMore: start + pageSize < filtered.length }
}

async function fixtures() {
  return import('./devFixtures')
}

export const procurementApi = {
  async overview({ signal } = {}) {
    if (useDevFixtures) return (await fixtures()).overviewFixture()
    return request('/overview', { signal })
  },
  async cards(filters = {}, signal) {
    if (useDevFixtures) return fixturePage((await fixtures()).cards.map(adaptCard), filters, ['id', 'title', 'casNumber', 'substanceName'])
    return adaptPage(await request('/cards', { params: filters, signal }), adaptCard)
  },
  async card(id, signal) {
    if (useDevFixtures) return (await fixtures()).cards.map(adaptCard).find(item => String(item.id) === String(id)) || null
    return adaptCard(await request(`/cards/${encodeURIComponent(id)}`, { signal }))
  },
  async suppliers(filters = {}, signal) {
    if (useDevFixtures) return fixturePage((await fixtures()).suppliers.map(adaptSupplier), filters, ['id', 'name', 'country', 'contacts'])
    return adaptPage(await request('/suppliers', { params: filters, signal }), adaptSupplier)
  },
  async supplier(id, signal) {
    if (useDevFixtures) {
      const fixture = await fixtures()
      const supplier = fixture.suppliers.map(adaptSupplier).find(item => item.id === id)
      if (!supplier) return null
      return { supplier, negotiations: fixture.negotiations.filter(item => item.supplierId === id), proposals: fixture.proposals.filter(item => item.supplierId === id), communications: fixture.messages }
    }
    return request(`/suppliers/${encodeURIComponent(id)}`, { signal })
  },
  async negotiations(filters = {}, signal) {
    if (useDevFixtures) return fixturePage((await fixtures()).negotiations, filters, ['id', 'cardId', 'cardTitle', 'supplierId', 'supplierName', 'contactId', 'contactName', 'channel'])
    return adaptPage(await request('/negotiations', { params: filters, signal }))
  },
  async negotiation(id, signal) {
    if (useDevFixtures) {
      const fixture = await fixtures()
      const negotiation = fixture.negotiations.find(item => item.id === id)
      if (!negotiation) return null
      return { ...negotiation, messages: fixture.messages, proposal: fixture.proposals.find(item => item.cardId === negotiation.cardId && item.supplierId === negotiation.supplierId) }
    }
    return request(`/negotiations/${encodeURIComponent(id)}`, { signal })
  },
  async proposals(filters = {}, signal) {
    if (useDevFixtures) return fixturePage((await fixtures()).proposals, filters, ['id', 'supplierName', 'currency', 'incoterm'])
    return adaptPage(await request('/proposals', { params: filters, signal }))
  },
  async proposal(id, signal) {
    if (useDevFixtures) return (await fixtures()).proposals.find(item => item.id === id) || null
    return request(`/proposals/${encodeURIComponent(id)}`, { signal })
  },
  async comparison(cardId, signal) {
    if (useDevFixtures) return { cardId: Number(cardId), rows: (await fixtures()).proposals.filter(item => String(item.cardId) === String(cardId)), decisionNote: 'Сравнение носит описательный характер. Итоговое решение принимает специалист по закупкам.' }
    return request('/proposals/compare', { params: { cardId }, signal })
  },
  async escalations(filters = {}, signal) {
    if (useDevFixtures) return fixturePage((await fixtures()).escalations, filters, ['id', 'title', 'cardId', 'cardTitle', 'supplierId', 'supplierName', 'negotiationId', 'proposalId', 'assignedTo'])
    return adaptPage(await request('/escalations', { params: filters, signal }))
  },
  async activity(filters = {}, signal) {
    if (useDevFixtures) return fixturePage((await fixtures()).activity, filters, ['id', 'title', 'description', 'type', 'entityId', 'cardId'])
    return adaptPage(await request('/activity', { params: filters, signal }))
  },
}
