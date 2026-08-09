import { useExtensions } from '../../registry/ExtensionContext'

export function useProcurementPermissions() {
  const { getExtension } = useExtensions()
  const permissions = getExtension('procurement')?.capability?.permissions || []
  const set = new Set(permissions)
  return {
    canReadCards: set.has('CARD_READ'),
    canWriteCards: set.has('CARD_WRITE'),
    canWriteSuppliers: set.has('SUPPLIER_WRITE'),
    canQualifySuppliers: set.has('SUPPLIER_QUALIFY'),
    canOperateEchemi: set.has('ECHEMI_OPERATE'),
    canSubmitEchemi: set.has('ECHEMI_SUBMIT'),
    canReadCommunications: set.has('COMMUNICATION_READ'),
    canManageNegotiations: set.has('NEGOTIATION_MANAGE'),
    canQueueNegotiations: set.has('NEGOTIATION_QUEUE'),
    canWriteSupplierResponses: set.has('SUPPLIER_RESPONSE_WRITE'),
    canReadAudit: set.has('AUDIT_READ'),
  }
}
