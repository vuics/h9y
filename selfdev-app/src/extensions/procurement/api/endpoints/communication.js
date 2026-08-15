/** Communication playbook: the library and the composition records.
 *
 * Grouped like the backend router it talks to. Reads answer from fixtures in
 * demonstration mode; every write is refused there, the same as elsewhere.
 */

import { fixtures, mutation, read } from '../devMode'
import { id, request } from '../http'

export const communicationEndpoints = {
  playbookVocabulary: read(
    ({ signal } = {}) => request('/communication/vocabulary', { signal }),
    async () => (await fixtures()).playbookVocabularyFixture(),
  ),
  playbook: read(
    (filters = {}, signal) => request('/communication/playbook', { params: filters, signal }),
    async (filters = {}) => (await fixtures()).playbookFixture(filters),
  ),
  playbookItem: read(
    (itemId, signal) => request(`/communication/playbook/${id(itemId)}`, { signal }),
    async itemId => (await fixtures()).playbookItemFixture(itemId),
  ),
  playbookItemUsage: read(
    (itemId, signal) => request(`/communication/playbook/${id(itemId)}/usage`, { signal }),
    async itemId => ({ itemId, compositions: [], hasMore: false }),
  ),
  createPlaybookItem: mutation(payload =>
    request('/communication/playbook', { method: 'post', data: payload })),
  updatePlaybookItem: mutation((itemId, payload) =>
    request(`/communication/playbook/${id(itemId)}`, { method: 'patch', data: payload })),
  previewPlaybook: mutation(payload =>
    request('/communication/playbook/preview', { method: 'post', data: payload })),
  communicationPolicy: read(
    ({ signal } = {}) => request('/communication/policy', { signal }),
    async () => ({ draftFirstStages: ['FIRST_CONTACT'], draftFirstSupplierIds: [], draftFirstAll: false }),
  ),
  updateCommunicationPolicy: mutation(payload =>
    request('/communication/policy', { method: 'put', data: payload })),
  compositions: read(
    (filters = {}, signal) =>
      request('/communication/compositions', { params: filters, signal }),
    async (filters = {}) => (await fixtures()).compositionsFixture(filters),
  ),
  composition: read(
    (compositionId, signal) =>
      request(`/communication/compositions/${id(compositionId)}`, { signal }),
    async compositionId => (await fixtures()).compositionFixture(compositionId),
  ),
  approveComposition: mutation((compositionId, payload = {}) =>
    request(`/communication/compositions/${id(compositionId)}/approve`, {
      method: 'post',
      data: payload,
    })),
  rejectComposition: mutation((compositionId, note) =>
    request(`/communication/compositions/${id(compositionId)}/reject`, {
      method: 'post',
      data: { note },
    })),
}
