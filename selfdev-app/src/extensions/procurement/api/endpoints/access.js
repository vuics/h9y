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
    async () => ({
      principals: [],
      invitations: [{ email: 'buyer@demo.example', pendingRoles: ['PROCUREMENT_USER'], invitedAt: '2026-10-19T09:00:00Z' }],
      scopeAgentId: null,
      truncated: false,
    }),
  ),
  accessPrincipal: read(
    (principalKey, signal) => request(`/access/principals/${encodeURIComponent(principalKey)}`, { signal }),
    async () => null,
  ),
  grantAccess: mutation(({ principalKey, ...body }) => request(
    `/access/principals/${encodeURIComponent(principalKey)}/grants`,
    { method: 'post', data: body },
  )),
  inviteMember: mutation(({ email, roles }) => request(
    '/access/members',
    { method: 'post', data: { email, roles } },
  )),
  removeMember: mutation(({ email }) => request(
    '/access/members/remove',
    { method: 'post', data: { email } },
  )),
  organizations: read(
    signal => request('/organizations', { signal }),
    // Two organizations and the operator's panel, so the switcher and the
    // operator controls can be seen without a multi-tenant backend.
    async () => ({
      current: { id: 'demo', name: 'Демо-организация' },
      organizations: [
        { id: 'demo', name: 'Демо-организация', status: 'ACTIVE', database: 'procurement', agentIds: ['agent-1'], echemi: true, echemiInstallationAccount: true },
        { id: 'beta', name: 'Бета Химия', status: 'SUSPENDED', database: 'procurement_beta', agentIds: [], echemi: false, echemiInstallationAccount: false },
      ],
      superadmin: true,
    }),
  ),
  createOrganization: mutation(body => request('/organizations', { method: 'post', data: body })),
  setOrganizationStatus: mutation(({ id, suspend }) => request(
    `/organizations/${encodeURIComponent(id)}/${suspend ? 'suspend' : 'reactivate'}`,
    { method: 'post' },
  )),
  organizationAgents: read(
    signal => request('/organizations/agents', { signal }),
    async () => ({
      agents: [
        { id: 'agent-1', name: 'demo-procurement', kind: 'PROCUREMENT', deployed: true, owner: 'admin@demo.example', ownedByMe: true, binding: 'EXPLICIT', organization: { id: 'demo', name: 'Демо-организация' } },
        { id: 'agent-2', name: 'demo-negotiator', kind: 'NEGOTIATOR', deployed: true, owner: 'buyer@demo.example', ownedByMe: false, binding: 'NONE', organization: null },
        { id: 'agent-3', name: 'elsewhere-negotiator', kind: 'NEGOTIATOR', deployed: false, owner: 'buyer@demo.example', ownedByMe: false, binding: 'EXPLICIT', organization: { hidden: true } },
      ],
      organizations: [{ id: 'demo', name: 'Демо-организация' }],
      superadmin: false,
    }),
  ),
  bindAgent: mutation(({ agentId, organizationId }) => request(
    `/organizations/agents/${encodeURIComponent(agentId)}`,
    { method: 'post', data: { organizationId } },
  )),
  setOrganizationEchemi: mutation(({ id, enabled }) => request(
    `/organizations/${encodeURIComponent(id)}/echemi`,
    { method: 'post', data: { enabled } },
  )),
  organizationEvents: read(
    signal => request('/organizations/events', { params: { limit: 100 }, signal }),
    async () => ({ events: [
      { kind: 'ORGANIZATION_SUSPENDED', organizationId: 'beta', actor: 'USER:operator', details: {}, at: '2026-10-19T09:30:00Z' },
      { kind: 'MEMBER_INVITED', organizationId: 'demo', actor: 'USER:admin', details: { email: 'buyer@demo.example' }, at: '2026-10-19T09:00:00Z' },
    ] }),
  ),
  revokeAccess: mutation(({ principalKey, bindingId }) => request(
    `/access/principals/${encodeURIComponent(principalKey)}/grants/revoke`,
    { method: 'post', data: { bindingId } },
  )),
}
