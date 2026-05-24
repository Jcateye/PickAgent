import type { CanonicalRuleDto, ParseStatus, SimulationRequestDto, SimulationResultDto } from "./businessFoundation";

export type ActivityStatus = "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED";
export type ActivityPlanStepStatus = "DONE" | "RUNNING" | "WAITING" | "FAILED";
export type ActivityPlanStepOwner = "SYSTEM" | "OPERATOR" | "AGENT";
export type RequiredFieldStatus = "READY" | "MISSING" | "STALE" | "EXTERNAL_DEPENDENCY" | "AMBIGUOUS_MAPPING";
export type ActivityDataSourceStatus = "AVAILABLE" | "STALE" | "FAILED" | "DELAYED";
export type PendingConfirmationType = "RULE_AMBIGUITY" | "FIELD_MAPPING" | "DATA_SOURCE" | "RISK_ACTION";

export interface TraceableRef {
  entityType:
    | "sku_profile"
    | "sku_snapshot"
    | "health_diagnosis"
    | "activity"
    | "rule_set"
    | "simulation_run"
    | "simulation_result"
    | "review_item"
    | "workflow_run"
    | "workflow_step"
    | "agent_mission"
    | "agent_run"
    | "agent_tool_call"
    | "connector"
    | "report";
  entityId: string;
  label: string;
  href?: string;
  drawerTarget?: string;
}

export interface EvidenceRef extends TraceableRef {
  sourceType: TraceableRef["entityType"];
  sourceId: string;
  field?: string;
  rawValue?: unknown;
  normalizedValue?: unknown;
  ruleId?: string;
  evidenceText?: string;
  collectedAt?: string;
}

export interface ActivityDto {
  activityId: string;
  name: string;
  platform?: string;
  categoryScope?: string[];
  productScopeText: string;
  status: ActivityStatus;
  startAt?: string;
  endAt?: string;
  currentRuleSetId?: string;
  latestRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityRequestDto {
  name: string;
  platform?: string;
  categoryScope?: string[];
  productScopeText?: string;
  startAt?: string;
  endAt?: string;
}

export interface UpdateActivityRequestDto {
  name?: string;
  platform?: string;
  categoryScope?: string[];
  productScopeText?: string;
  status?: ActivityStatus;
  startAt?: string | null;
  endAt?: string | null;
}

export interface ParseActivityRuleSetRequestDto {
  name?: string;
  sourceText: string;
  rules?: CanonicalRuleDto[];
}

export interface ActivityRuleSetSummaryDto {
  ruleSetId: string;
  version: string;
  parseStatus: ParseStatus;
  confidence: number;
  rules: CanonicalRuleDto[];
}

export interface ActivityExecutionPlanDto {
  activityId: string;
  runId?: string;
  ruleSet: ActivityRuleSetSummaryDto;
  steps: Array<{
    stepKey: "parse_rules" | "structure_rule_dsl" | "extract_required_fields" | "check_data_availability" | "simulate_readiness" | "generate_checklist";
    title: string;
    status: ActivityPlanStepStatus;
    owner: ActivityPlanStepOwner;
    outputSummary?: string;
    toolName?: string;
    traceRef?: TraceableRef;
  }>;
  requiredFields: Array<{
    field: string;
    label: string;
    status: RequiredFieldStatus;
    dataSource?: string;
    freshness?: string;
  }>;
  dataSources: Array<{
    connectorId: string;
    name: string;
    status: ActivityDataSourceStatus;
    lastSyncedAt?: string;
  }>;
  pendingConfirmations: Array<{
    reviewItemId?: string;
    type: PendingConfirmationType;
    title: string;
    actionLabel: string;
  }>;
  relatedRuns: TraceableRef[];
}

export interface ActivitySimulationRunDetailDto {
  activityId: string;
  simulationRunId: string;
  activityRuleSetId: string;
  status: "SUCCEEDED";
  scope: { skuProfileIds: string[]; whatIf?: SimulationRequestDto["whatIf"] };
  results: SimulationResultDto[];
  plan: ActivityExecutionPlanDto["steps"];
  evidenceRefs: EvidenceRef[];
  startedAt: string;
  completedAt: string;
}
