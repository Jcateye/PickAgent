export type HealthStatus = 'READY' | 'REPAIRABLE' | 'RISKY' | 'BLOCKED'

export type ConnectorStatus = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'SETUP_REQUIRED'

export type WorkflowRunStatus = 'SUCCEEDED' | 'RUNNING' | 'WAITING_FOR_REVIEW' | 'FAILED'

export type StatusTone = 'neutral' | 'ready' | 'review' | 'warning' | 'blocked'

export interface ApiViewState {
  kind: 'real' | 'empty' | 'fallback'
  endpoint: string
  message: string
  requestId?: string
}

export interface DashboardMetricDto {
  id: string
  label: string
  value: string
  description: string
  tone: StatusTone
}

export interface DashboardRiskSummaryDto {
  id: string
  label: string
  count: number
  description: string
  targetHref: string
  tone: StatusTone
}

export interface RecentWorkflowRunDto {
  id: string
  title: string
  source: string
  status: WorkflowRunStatus
  finishedAtLabel: string
  targetHref: string
  summary: string
}

export interface DashboardSummaryDto {
  metrics: DashboardMetricDto[]
  riskSummaries: DashboardRiskSummaryDto[]
  recentRuns: RecentWorkflowRunDto[]
  primaryLinks: Array<{
    label: string
    href: string
    description: string
  }>
  viewState?: ApiViewState
}

export interface ConnectorDto {
  id: string
  name: string
  platform: string
  status: ConnectorStatus
  lastIngestedAtLabel: string
  lastIngestSummary: string
  capabilityBoundary: string
  targetHref: string
}

export interface ConnectorConsoleDto {
  connectors: ConnectorDto[]
  collectionBoundaries: Array<{
    id: string
    label: string
    description: string
  }>
  viewState?: ApiViewState
}

export interface CurrentSkuProjectionDto {
  skuProfileId: string
  canonicalSkuKey: string
  productName: string
  platform: string
  storeName: string
  healthStatus: HealthStatus
  healthScore: number
  dataQualityScore: number
  issueSummary: string
  nextAction: string
  updatedAtLabel: string
  targetHref: string
}

export interface SkuIssueDto {
  id: string
  severity: StatusTone
  title: string
  summary: string
}

export interface SkuEvidenceDto {
  id: string
  label: string
  value: string
  source: string
}

export interface SkuDetailDto {
  projection: CurrentSkuProjectionDto
  issues: SkuIssueDto[]
  evidence: SkuEvidenceDto[]
  nextActions: Array<{
    id: string
    title: string
    description: string
    owner: string
  }>
  traceability?: {
    snapshot: {
      id: string
      collectedAtLabel: string
      summary: string
    } | null
    diagnosis: {
      id: string
      diagnosedAtLabel: string
      summary: string
    } | null
    collectionRisks: string[]
    evidenceSources: string[]
  }
  viewState?: ApiViewState
}

export function healthStatusTone(status: HealthStatus): StatusTone {
  const toneByStatus: Record<HealthStatus, StatusTone> = {
    READY: 'ready',
    REPAIRABLE: 'review',
    RISKY: 'warning',
    BLOCKED: 'blocked',
  }

  return toneByStatus[status]
}

export function workflowRunTone(status: WorkflowRunStatus): StatusTone {
  const toneByStatus: Record<WorkflowRunStatus, StatusTone> = {
    SUCCEEDED: 'ready',
    RUNNING: 'warning',
    WAITING_FOR_REVIEW: 'review',
    FAILED: 'blocked',
  }

  return toneByStatus[status]
}

export function connectorStatusTone(status: ConnectorStatus): StatusTone {
  const toneByStatus: Record<ConnectorStatus, StatusTone> = {
    CONNECTED: 'ready',
    DEGRADED: 'review',
    DISCONNECTED: 'blocked',
    SETUP_REQUIRED: 'neutral',
  }

  return toneByStatus[status]
}
