export type ReviewSourceType = 'health_diagnosis' | 'activity_simulation' | 'agent_gate'

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export type ReviewDecision = 'approve' | 'reject' | 'request_changes'

export type ReviewRiskLevel = 'low' | 'medium' | 'high'

export interface ReviewSourceObjectDto {
  id: string
  type: ReviewSourceType
  title: string
  routeLabel: string
  href: string
}

export interface ReviewEvidenceSummaryDto {
  id: string
  label: string
  value: string
  source: string
  href: string
}

export interface ReviewItemDto {
  id: string
  targetLabel: string
  status: ReviewStatus
  source: ReviewSourceObjectDto
  question: string
  recommendation: string
  riskLevel: ReviewRiskLevel
  riskSummary: string
  evidenceSummary: ReviewEvidenceSummaryDto[]
  createdAt: string
  updatedAt: string
  decisionComment?: string
  decidedAt?: string
}

export interface ReviewListFiltersDto {
  status: ReviewStatus | 'all'
  sourceType: ReviewSourceType | 'all'
}

export interface ReviewDecisionResultDto {
  reviewId: string
  status: ReviewStatus
  decision: ReviewDecision
  comment: string
  decidedAt: string
}
