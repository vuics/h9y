import { useExtensions } from '../../registry/ExtensionContext'

export function useProcurementPermissions() {
  const { getExtension } = useExtensions()
  const capability = getExtension('procurement')?.capability
  const permissions = capability?.permissions || []
  const features = capability?.features || {}
  const set = new Set(permissions)
  return {
    canReadCards: set.has('CARD_READ'),
    canWriteCards: set.has('CARD_WRITE'),
    canWriteSuppliers: set.has('SUPPLIER_WRITE'),
    canQualifySuppliers: set.has('SUPPLIER_QUALIFY'),
    canOperateEchemi: set.has('ECHEMI_OPERATE'),
    canSubmitEchemi: set.has('ECHEMI_SUBMIT'),
    canResearchSourcing: set.has('SOURCING_RESEARCH'),
    canReviewSourcing: set.has('SOURCING_REVIEW'),
    canReadCommunications: set.has('COMMUNICATION_READ'),
    canManageNegotiations: set.has('NEGOTIATION_MANAGE'),
    canQueueNegotiations: set.has('NEGOTIATION_QUEUE'),
    canWriteSupplierResponses: set.has('SUPPLIER_RESPONSE_WRITE'),
    canClaimEscalations: set.has('ESCALATION_CLAIM'),
    canRecommendEscalations: set.has('ESCALATION_RECOMMEND'),
    canResolveEscalations: set.has('ESCALATION_RESOLVE'),
    canReadAudit: set.has('AUDIT_READ'),
    canReadPlaybook: set.has('PLAYBOOK_READ'),
    canWritePlaybook: set.has('PLAYBOOK_WRITE'),
    canApprovePlaybook: set.has('PLAYBOOK_APPROVE'),
    // A deployment switch, not a grant: served by the API so a stale bundle
    // cannot keep offering a feature the installation turned off.
    simulationEnabled: features.supplierSimulation !== false,
  }
}
