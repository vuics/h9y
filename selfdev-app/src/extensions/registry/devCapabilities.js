export const developmentCapabilities = {
  apiVersion: 1,
  extensions: [{
    id: 'procurement',
    title: 'Procurement',
    enabled: true,
    apiVersion: 1,
    permissions: [
      'CARD_READ',
      'COMMUNICATION_READ',
      'ESCALATION_READ',
      'AUDIT_READ',
      'SOURCING_RESEARCH',
      'SOURCING_REVIEW',
    ],
    serviceAvailable: true,
    reason: 'Explicit local development fixture mode',
  }],
}
