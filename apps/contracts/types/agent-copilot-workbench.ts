export type AgentMissionStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'RUNNING'
  | 'WAITING_FOR_DATA'
  | 'WAITING_FOR_REVIEW'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'

export type AgentRunStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'PREPARING_CONTEXT'
  | 'RUNNING'
  | 'STREAMING'
  | 'CALLING_TOOL'
  | 'PAUSED'
  | 'TIMEOUT'
  | 'FAILED'
  | 'DONE'
  | 'CANCELED'

export type AgentReviewGateStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'CANCELED'

export type AgentPlanStepStatus = 'pending' | 'running' | 'completed' | 'waiting_for_review' | 'waiting_for_data'

export type AgentMessageRole = 'user' | 'assistant' | 'tool' | 'system'

export interface AgentLinkedEntity {
  id: string
  entityType: 'sku_profile' | 'activity_rule_set' | 'simulation_run' | 'review_item' | 'workflow_run'
  entityId: string
  label: string
  reason: string
  sourceType: 'mission' | 'run' | 'message' | 'tool_call' | 'review_gate'
  sourceId: string
}

export interface AgentEvidenceRef {
  id: string
  evidenceType: 'snapshot' | 'rule' | 'simulation' | 'review_gate' | 'tool_result'
  label: string
  summary: string
  entityType?: AgentLinkedEntity['entityType']
  entityId?: string
}

export interface AgentPlanStep {
  id: string
  title: string
  detail: string
  status: AgentPlanStepStatus
  toolName?: string
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

export interface AgentReviewGate {
  id: string
  status: AgentReviewGateStatus
  reasonCode: string
  question: string
  agentRecommendation: string
  riskIfApproved: string
  riskIfRejected: string
  evidenceRefs: string[]
  decision?: 'approve' | 'reject' | 'modify'
  decisionComment?: string
}

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  status: 'completed' | 'streaming'
  linkedEntityIds?: string[]
  evidenceRefIds?: string[]
}

export interface AgentMissionRun {
  mission: {
    id: string
    objective: string
    status: AgentMissionStatus
    autonomyLevel: 'L1_ASSISTED' | 'L2_REVIEW_GATED_AGENT'
    sourceSurface: 'agent_copilot'
  }
  run: {
    id: string
    status: AgentRunStatus
    provider: 'fake' | 'pi'
    progressPercent: number
  }
  messages: AgentMessage[]
  plan: AgentPlanStep[]
  toolTrace: AgentToolTrace[]
  linkedEntities: AgentLinkedEntity[]
  evidenceRefs: AgentEvidenceRef[]
  reviewGates: AgentReviewGate[]
  nextActions: string[]
  eventContractVersion: 'agent-run-events.v1'
}

export type AgentRunEventType =
  | 'mission.created'
  | 'run.status_changed'
  | 'message.appended'
  | 'plan.updated'
  | 'tool_call.updated'
  | 'context.linked'
  | 'evidence.linked'
  | 'review_gate.opened'
  | 'review_gate.decided'
  | 'run.completed'

export interface AgentRunEvent {
  id: string
  runId: string
  sequence: number
  eventType: AgentRunEventType
  eventPhase?: 'planning' | 'executing' | 'paused' | 'resuming' | 'completed'
  payload: Record<string, unknown>
}
