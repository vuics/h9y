import { useExtensions } from '../../registry/ExtensionContext'

export function useProcurementPermissions() {
  const { getExtension } = useExtensions()
  const permissions = getExtension('procurement')?.capability?.permissions || []
  const set = new Set(permissions)
  return {
    canReadCards: set.has('CARD_READ'),
    canWriteCards: set.has('CARD_WRITE'),
    canReadCommunications: set.has('COMMUNICATION_READ'),
    canReadAudit: set.has('AUDIT_READ'),
  }
}
