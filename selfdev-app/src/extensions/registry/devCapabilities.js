export const developmentCapabilities = {
  apiVersion: 1,
  extensions: [{
    id: 'procurement',
    title: 'Procurement',
    enabled: true,
    apiVersion: 1,
    permissions: [
      'CARD_READ',
      // Shows the controls that write; every write is still refused in
      // fixture mode, so the page can be seen as a purchaser sees it.
      'CARD_WRITE',
      'ECHEMI_OPERATE',
      'ECHEMI_SUBMIT',
      'COMMUNICATION_READ',
      'ESCALATION_READ',
      'ESCALATION_CLAIM',
      'ESCALATION_RESOLVE',
      'AUDIT_READ',
      'SOURCING_RESEARCH',
      'SOURCING_REVIEW',
      // Shows the access page with its organization panels.
      'EXPERT_REGISTRY_MANAGE',
    ],
    features: { organizations: true, echemi: true },
    organization: { id: 'demo', name: 'Демо-организация' },
    serviceAvailable: true,
    reason: 'Explicit local development fixture mode',
  }],
}
