export type WorkbenchEntityType = 'dashboard' | 'sku' | 'activityRuleSet' | 'simulationRun' | 'reviewItem' | 'report' | 'connector' | 'ruleSet'

export interface WorkbenchContext {
  route: string
  pageTitle: string
  selectedEntity?: {
    entityType: WorkbenchEntityType
    entityId: string
    label: string
  }
  visibleFilters: Record<string, unknown>
  visibleColumns?: string[]
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  status: 'completed' | 'streaming'
  linkedEntityIds?: string[]
  evidenceRefIds?: string[]
}

export interface AgentToolTrace {
  id: string
  toolName: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'waiting_for_approval'
  riskLevel: 'L0' | 'L1' | 'L2'
  reviewPolicy: 'none' | 'review_gate'
  inputSummary: string
  outputSummary: string
  evidenceRefs: string[]
}

export interface AgentLinkedEntity {
  id: string
  entityType: 'dashboard' | 'sku_profile' | 'activity' | 'activity_rule_set' | 'rule_set' | 'simulation_run' | 'review_item' | 'workflow_run' | 'report' | 'connector' | 'agent_mission' | 'download_artifact'
  entityId: string
  label: string
  reason: string
  sourceType: 'mission' | 'run' | 'message' | 'tool_call' | 'review_gate'
  sourceId: string
  href?: string
}

export interface AgentEvidenceRef {
  id: string
  evidenceType: 'snapshot' | 'rule' | 'simulation' | 'review_gate' | 'tool_result'
  label: string
  summary: string
  entityType?: AgentLinkedEntity['entityType']
  entityId?: string
}

export interface AgentReviewGate {
  id: string
  status: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'CANCELED'
  reasonCode: string
  question: string
  agentRecommendation: string
  riskIfApproved: string
  riskIfRejected: string
  evidenceRefs: string[]
  reviewItemId?: string
  runTraceHref?: string
  decision?: 'approve' | 'reject' | 'modify'
  decisionComment?: string
  continuationRunId?: string
}

export interface AgentRunEvent {
  id: string
  runId: string
  sequence: number
  eventType: string
  eventPhase: string | null
  payloadJson: Record<string, unknown>
  createdAt: string
}
