export type Page<T> = {
  items: T[]
  page: number
  pageSize: number
  total?: number
  hasMore?: boolean
}

export type FieldState = 'PRESENT' | 'UNKNOWN' | 'AMBIGUOUS' | 'CONFLICT' | 'INVALID'
export type CompletenessState = 'COMPLETE' | 'NEEDS_CLARIFICATION' | 'CONFLICTING' | 'NEEDS_HUMAN_REVIEW'

export interface ProcurementCardDto {
  id: number
  title: string
  casNumber?: string
  substanceName?: string
  purity?: string
  targetVolume?: string
  stage: string
  rfqStatus?: string
  normalizationStatus?: string
  completeness?: CompletenessState
  supplierCount?: number
  proposalCount?: number
  updatedAt?: string
}

export interface SupplierDto {
  id: string
  name: string
  country?: string
  qualificationStatus: string
  contacts: SupplierContactDto[]
  capabilities: SupplierCapabilityDto[]
  updatedAt?: string
}

export interface SupplierContactDto {
  id: string
  name?: string
  role?: string
  channel: string
  address: string
  verificationStatus: string
  active: boolean
}

export interface SupplierCapabilityDto {
  casNumber: string
  productName?: string
  verificationStatus: string
  source: string
  sourceUrl?: string
}

export interface NegotiationDto {
  id: string
  cardId: number
  cardTitle: string
  supplierId: string
  supplierName: string
  contactId: string
  contactName?: string
  channel: string
  status: string
  nextAction?: string
  nextActionAt?: string
  lastDispatchStatus?: string
  lastWorkerError?: string
  requiresHuman: boolean
  updatedAt?: string
}

export interface ProposalDto {
  id: string
  cardId: number
  supplierId?: string
  supplierName: string
  revision: number
  completeness: CompletenessState
  productIdentityStatus: string
  price?: string
  currency?: string
  priceUnit?: string
  quantity?: string
  moq?: string
  incoterm?: string
  namedPlace?: string
  leadTime?: string
  paymentTerms?: string
  grade?: string
  purity?: string
  coa: string
  tds: string
  sds: string
  sampleAvailable?: string
  fieldStates?: Record<string, FieldState>
  originalValues?: Record<string, string>
  warnings: string[]
  updatedAt?: string
}

export interface EscalationDto {
  id: string
  cardId: number
  cardTitle: string
  supplierId: string
  supplierName: string
  contactId?: string
  status: string
  priority: number
  title: string
  recommendation: string
  risks: { category: string; code: string; reason: string; evidence: string[] }[]
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

export interface ActivityDto {
  id: string
  type: string
  level: 'info' | 'warning' | 'error' | 'success'
  title: string
  description?: string
  entityType?: string
  entityId?: string
  cardId?: number
  retryStatus?: string
  diagnostic?: string
  createdAt: string
}
