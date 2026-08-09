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
  sourcing?: {
    runId: string
    status: string
    candidateCount: number
    greenCandidateCount: number
    verifiedCandidateCount: number
  }
  updatedAt?: string
}

export interface SourcingRunDto {
  id: string
  cardId: number
  requestedCas: string
  requestedProductName: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  queryPlan: string[]
  sources: SourcingSourceDto[]
  candidates: SourcingCandidateDto[]
  errors: string[]
  initiatedByPrincipalKey: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  automaticVerification: false
  decisionNote: string
}

export interface SourcingSourceDto {
  id: string
  url: string
  finalUrl: string
  domain: string
  title: string
  sourceType: 'OFFICIAL_COMPANY' | 'GOVERNMENT_REGISTRY' | 'REGULATOR' | 'MARKETPLACE' | 'TRADE_DIRECTORY' | 'NEWS' | 'SEARCH_SNIPPET' | 'OTHER'
  query?: string
  retrievedAt: string
  fetchStatus: string
  claimCount: number
  extractionWarnings: string[]
}

export interface SourcingCandidateDto {
  id: string
  name: string
  aliases: string[]
  country?: string
  website?: string
  role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'BOTH' | 'UNKNOWN'
  score: number
  preliminaryStatus: 'GREEN' | 'YELLOW' | 'RED'
  reviewDecision: 'UNREVIEWED' | 'UNDER_REVIEW' | 'VERIFIED_MANUFACTURER' | 'VERIFIED_DISTRIBUTOR' | 'NEEDS_MORE_EVIDENCE' | 'REJECTED'
  promotedSupplierId?: string
  reliabilitySignals: string[]
  riskSignals: string[]
  evidenceGaps: string[]
  sourceIds: string[]
  evidence: SourcingEvidenceDto[]
  reviewHistory: SourcingReviewDto[]
}

export interface SourcingEvidenceDto {
  id: string
  category: string
  polarity: 'POSITIVE' | 'NEGATIVE' | 'CONFLICT'
  value: string
  quote: string
  validUntil?: string
  sourceId: string
  sourceUrl?: string
  sourceType?: string
  sourceRetrievedAt?: string
}

export interface SourcingReviewDto {
  decision: SourcingCandidateDto['reviewDecision']
  note: string
  actorPrincipalKey: string
  reviewedAt: string
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

export interface EchemiStateDto {
  cardId: number
  cardTitle: string
  cardStatus: string
  rfqStatus: string
  casNumber: string
  targetVolume?: string
  submissionEnabled: boolean
  noVncUrl: string
  search: {
    query?: string
    status: 'NOT_STARTED' | 'COMPLETED' | 'FAILED' | 'HUMAN_ACTION_REQUIRED'
    stage?: string
    searchedAt?: string
    errorCode?: string
    results: EchemiCandidateDto[]
  }
  inquiries: EchemiInquiryDto[]
}

export interface EchemiBrowserAccessDto {
  cardId: number
  url: string
  passwordRequired: boolean
  password?: string | null
}

export interface EchemiCandidateDto {
  product_id: string
  product_name: string
  cas_number: string
  seller_name: string
  product_url: string
  eligible_for_inquiry: boolean
  exact_cas_match: boolean
  manufacturer_status: 'UNVERIFIED'
}

export interface EchemiInquiryDto {
  inquiryId: string
  status: string
  staleReason?: string
  sellerName?: string
  productUrl?: string
  payload: Record<string, string | number>
  preparedAt?: string
  previewedAt?: string
  approvedAt?: string
  submittedAt?: string
  platformMessage?: string
  lastError?: string
  verificationStage?: string
  verificationResumeStatus?: string
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
  contactVerificationStatus?: string
  contactActive: boolean
  channel: string
  status: string
  rfqId?: string
  authority?: string
  priority: number
  nextAction?: string
  nextActionAt?: string
  followUpAfterHours?: number
  nextFollowUpAt?: string
  attemptCount: number
  lastDispatchStatus?: string
  lastDispatchAt?: string
  lastWorkerError?: string
  escalationReason?: string
  staleReason?: string
  statusHistory: NegotiationStatusChangeDto[]
  requiresHuman: boolean
  updatedAt?: string
}

export interface NegotiationStatusChangeDto {
  fromStatus?: string
  toStatus: string
  reason?: string
  source: string
  actorPrincipalKey?: string
  changedAt: string
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
  negotiationId?: string
  attachments?: SupplierResponseAttachmentDto[]
  sourceReferences?: { sourceId: string; channel: string; receivedAt?: string; sha256: string }[]
}

export interface SupplierResponseAttachmentDto {
  id: string
  filename: string
  contentType?: string
  size: number
  sha256: string
  status: string
  recognizedAt?: string
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
