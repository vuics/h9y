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

export interface RFQDocumentDto {
  cardId: number
  cardTitle: string
  cardStatus: string
  status: 'NOT_PREPARED' | 'AWAITING_APPROVAL' | 'APPROVED'
  approvedAt?: string
  approvedBy?: string
  sentToSupplier: boolean
  documentFingerprint?: string
  rfq?: {
    id: string
    requestFingerprint: string
    generatedAt: string
    english: RFQLanguageDto
    russian: RFQLanguageDto
  }
}

export interface RFQLanguageDto {
  language: 'en' | 'ru'
  subject: string
  bodyMarkdown: string
  emailText: string
}

export interface SupplierDto {
  id: string
  name: string
  country?: string
  qualificationStatus: string
  qualificationUpdatedAt?: string
  qualificationHistory?: SupplierQualificationChangeDto[]
  sourceProfiles?: SupplierSourceProfileDto[]
  contacts: SupplierContactDto[]
  capabilities: SupplierCapabilityDto[]
  updatedAt?: string
}

export interface SupplierQualificationChangeDto {
  fromStatus?: string
  toStatus: string
  source: string
  actorPrincipalKey?: string
  changedAt: string
}

export interface SupplierSourceProfileDto {
  source: string
  identity?: string
  profileStatus: string
  observedAt?: string
}

export interface SupplierContactDto {
  id: string
  name?: string
  role?: string
  channel: string
  address: string
  verificationStatus: string
  active: boolean
  language?: string
  timezone?: string
  source?: string
  updatedAt?: string
}

export interface SupplierCapabilityDto {
  casNumber: string
  productName?: string
  verificationStatus: string
  source: string
  sourceUrl?: string
  sourceProductId?: string
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
