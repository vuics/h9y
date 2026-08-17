import { mutation, read } from '../devMode'
import { request } from '../http'

/** Demonstration mode shows the vocabulary with nothing grantable.
 *
 * An empty `grantableRoles` is what the API returns to someone who may manage
 * access but holds no permissions of their own, so the page renders its real
 * "you cannot confer this" state rather than a fabricated administrator.
 */
const emptyVocabulary = {
  roles: [], roleNote: '', permissions: [], decisionAuthorities: [],
  grantableRoles: [], grantablePermissions: [], grantBasis: 'PLATFORM_ADMIN',
  scopeAgentId: null, actorPrincipalKey: null,
}

export const accessEndpoints = {
  accessVocabulary: read(
    signal => request('/access/vocabulary', { signal }),
    async () => emptyVocabulary,
  ),
  accessPrincipals: read(
    (filters, signal) => request('/access/principals', { params: { search: filters?.search }, signal }),
    async () => ({ principals: [], scopeAgentId: null, truncated: false }),
  ),
  accessPrincipal: read(
    (principalKey, signal) => request(`/access/principals/${encodeURIComponent(principalKey)}`, { signal }),
    async () => null,
  ),
  grantAccess: mutation(({ principalKey, ...body }) => request(
    `/access/principals/${encodeURIComponent(principalKey)}/grants`,
    { method: 'post', data: body },
  )),
  revokeAccess: mutation(({ principalKey, role }) => request(
    `/access/principals/${encodeURIComponent(principalKey)}/grants/revoke`,
    { method: 'post', data: { role } },
  )),
}
