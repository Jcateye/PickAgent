export type HealthStatus = "READY" | "WARNING" | "BLOCKED" | "UNKNOWN";
export type ParseStatus = "PARSED" | "NEEDS_REVIEW" | "FAILED";
export type SimulationEligibility = "DIRECT_READY" | "REPAIRABLE_READY" | "MANUAL_REVIEW" | "BLOCKED";
export type ReviewStatus = "OPEN" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
export type ReviewDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";
export type ReportType = "HEALTH" | "ACTIVITY";

export interface EvidenceLinkDto {
  type: "snapshot" | "diagnosis" | "rule" | "simulation" | "review" | "report" | "tool_trace";
  entityId: string;
  label: string;
  summary: string;
}

export interface IngestRowDto {
  platform: string;
  storeId: string;
  externalSkuId: string;
  productName?: string;
  category?: string;
  brand?: string;
  sourceUrl?: string;
  rowIndex?: number;
  sales30d?: number;
  positiveRate?: number;
  stock?: number;
  originalPrice?: number;
  lowestPrice30d?: number;
  campaignPrice?: number;
  joinedBrandDay?: boolean;
  certificateStatus?: string;
  raw: Record<string, unknown>;
}

export interface IngestPayloadDto {
  connectorId?: string;
  collectedAt: string;
  rows: IngestRowDto[];
}

export interface SkuSummaryDto {
  skuProfileId: string;
  canonicalSkuKey: string;
  productName: string;
  platform: string;
  storeId: string;
  healthStatus: HealthStatus;
  healthScore: number;
  dataQualityScore: number;
  topIssues: string[];
  nextActions: string[];
}

export interface SkuDetailDto extends SkuSummaryDto {
  latestSnapshot: NormalizedSkuSnapshotDto | null;
  latestDiagnosis: HealthDiagnosisDto | null;
  evidence: EvidenceLinkDto[];
}

export interface NormalizedSkuSnapshotDto {
  snapshotId: string;
  skuProfileId: string;
  collectedAt: string;
  productName: string;
  category?: string;
  brand?: string;
  sales30d?: number;
  positiveRate?: number;
  stock?: number;
  originalPrice?: number;
  lowestPrice30d?: number;
  campaignPrice?: number;
  joinedBrandDay?: boolean;
  certificateStatus?: string;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
}

export interface HealthDiagnosisDto {
  diagnosisId: string;
  skuProfileId: string;
  snapshotId: string;
  healthStatus: HealthStatus;
  healthScore: number;
  dataQualityScore: number;
  issues: string[];
  nextActions: string[];
  evidence: EvidenceLinkDto[];
  diagnosedAt: string;
}

export interface DataFreshnessDto {
  skuProfileId: string;
  snapshotId: string | null;
  collectedAt: string | null;
  checkedAt: string;
  maxAgeHours: number;
  ageHours: number | null;
  isFresh: boolean;
  reason: string;
  evidence: EvidenceLinkDto[];
}

export interface DecisionExplanationDto {
  skuProfileId: string;
  summary: string;
  recommendation: string;
  evidence: EvidenceLinkDto[];
  nextActions: string[];
}

export type RuleOperator = "gte" | "lte" | "eq" | "neq";
export type RuleType = "threshold" | "field_compare" | "boolean_block" | "data_required" | "quota" | "manual_review";

export interface CanonicalRuleDto {
  id: string;
  type: RuleType;
  field?: string;
  operator?: RuleOperator;
  value?: number | string | boolean;
  compareField?: string;
  message: string;
  severity: "info" | "warning" | "blocking";
}

export interface ActivityRuleSetDto {
  ruleSetId: string;
  name: string;
  platform?: string;
  sourceText: string;
  rules: CanonicalRuleDto[];
  parseStatus: ParseStatus;
  confidence: number;
  errors: string[];
  workflowRunId?: string;
}

export type TraceableEntityType =
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

export interface TraceableRefDto {
  entityType: TraceableEntityType;
  entityId: string;
  label: string;
  href?: string;
  drawerTarget?: string;
}

export type RuleSetTypeDto = "ACTIVITY_RULE" | "QUALIFICATION_RULE" | "CONTENT_RULE";
export type RuleSetStatusDto = "ENABLED" | "DRAFT" | "DISABLED";
export type RuleSetSourceDto = "PLATFORM" | "INTERNAL";

export interface RuleSetListItemDto {
  ruleSetId: string;
  name: string;
  type: RuleSetTypeDto;
  version: string;
  status: RuleSetStatusDto;
  source: RuleSetSourceDto;
  updatedAt: string;
  updatedBy: string;
  activeRunCount: number;
  workflowRunId?: string;
}

export interface RuleSetDetailDto extends RuleSetListItemDto {
  sourceText: string;
  summary: {
    ruleCount: number;
    validationMode: "BLOCK_AND_HINT" | "HINT_ONLY";
    failureHandling: "BLOCK" | "MANUAL_REVIEW" | "WARN";
    priority: "P0" | "P1" | "P2";
    scopeText: string;
    linkedDataSources: string[];
  };
  dslJson: CanonicalRuleDto[];
  affectedFields: Array<{
    field: string;
    label: string;
    required: boolean;
    dataSources: TraceableRefDto[];
  }>;
  manualReviewItems: Array<{
    reasonCode: string;
    question: string;
    confidence?: number;
  }>;
  relatedRuns: TraceableRefDto[];
}

export interface RuleSetVersionDto {
  ruleSetVersionId: string;
  ruleSetId: string;
  version: string;
  status: RuleSetStatusDto;
  sourceText: string;
  dslJson: CanonicalRuleDto[];
  affectedFields: RuleSetDetailDto["affectedFields"];
  manualReviewItems: RuleSetDetailDto["manualReviewItems"];
  createdAt: string;
  createdBy: string;
  workflowRunId?: string;
}

export interface WorkspaceSettingsDto {
  workspaceId: string;
  name: string;
  defaultTenantId: string;
  dataFreshnessThresholdHours: number;
  reviewSlaHours: {
    high: number;
    medium: number;
    low: number;
  };
  allowedAgentTools: string[];
  deniedRuntimeTools: string[];
  workflowRunId?: string;
}

export interface ToolPolicyDto {
  allowedAgentTools: string[];
  deniedRuntimeTools: string[];
  policyVersion: string;
  updatedAt: string;
  updatedBy: string;
  workflowRunId?: string;
}

export const defaultAgentToolNames = [
  "getDashboardContext",
  "getHealthSummary",
  "listRunConsole",
  "exportRunLogs",
  "searchSkus",
  "exportSkuList",
  "listRuleSets",
  "getRuleSetDetail",
  "listRuleSetVersions",
  "createRuleSet",
  "updateRuleSet",
  "createRuleSetVersion",
  "listActivities",
  "createActivity",
  "updateActivity",
  "getActivityExecutionPlan",
  "getActivitySimulationRunDetail",
  "startActivityRun",
  "addActivityCandidateSkus",
  "getSkuSummary",
  "ingestSkus",
  "parseActivityRules",
  "checkDataFreshness",
  "diagnoseSkuHealth",
  "simulateActivityReadiness",
  "runSimulation",
  "explainDecisionWithEvidence",
  "generateReport",
  "generateReportPreview",
  "listReviews",
  "createReviewItems",
  "getReviewDetail",
  "updateReviewItem",
  "decideReviewItem",
  "setSkuNextAction",
  "listConnectors",
  "getConnectorDetail",
  "listConnectorRuns",
  "getConnectorRunDetail",
  "createConnector",
  "updateConnector",
  "updateConnectorPermissions",
  "detectBrowserPage",
  "previewBrowserScan",
  "ingestBrowserScan",
  "runConnectorSync",
  "setConnectorStatus",
  "setRuleSetStatus",
  "retryRun",
  "listAgentMissions",
  "getAgentMission",
  "createAgentMission",
  "startAgentRun",
  "getAgentRunDetail",
  "pauseAgentRun",
  "cancelAgentRun",
  "answerAgentRunQuestion",
  "decideAgentReviewGate",
  "listReports",
  "getReportDetail",
  "listReportVersions",
  "getReportVersion",
  "compareReports",
  "exportReport",
  "subscribeReport",
  "getWorkspaceSettings",
  "updateWorkspaceSettings",
  "getToolPolicy",
  "updateToolPolicy",
  "listSettingsUsers",
  "updateSettingsUserStatus",
] as const;

export type AgentToolName = (typeof defaultAgentToolNames)[number];

export interface SettingsUserDto {
  userId: string;
  name: string;
  role: "op_team" | "qa_team" | "compliance_team" | "marketing_team" | string;
  teamName: string;
  status: "ACTIVE" | "DISABLED";
  workflowRunId?: string;
}

export interface WhatIfInputDto {
  stock?: number;
  campaignPrice?: number;
  certificateStatus?: string;
}

export interface SimulationRequestDto {
  ruleSetId: string;
  skuProfileIds: string[];
  whatIf?: WhatIfInputDto;
}

export interface SimulationResultDto {
  simulationResultId: string;
  skuProfileId: string;
  ruleSetId: string;
  eligibility: SimulationEligibility;
  failedRules: CanonicalRuleDto[];
  evidence: EvidenceLinkDto[];
  repairSuggestions: string[];
  originalEligibility?: SimulationEligibility;
}

export interface ReviewItemDto {
  reviewItemId: string;
  skuProfileId?: string;
  sourceType: "health" | "simulation" | "agent";
  sourceId: string;
  status: ReviewStatus;
  question: string;
  recommendation?: string;
  riskLevel: "L0" | "L1" | "L2";
  decision?: ReviewDecision;
  decisionBy?: string;
  decisionComment?: string;
  decidedAt?: string;
  evidence: EvidenceLinkDto[];
}

export interface ReportPreviewDto {
  reportId: string;
  type: ReportType;
  status: "PREVIEW";
  title: string;
  workflowRunId?: string;
  sections: Array<{ id: string; title: string; summary: string; evidence: EvidenceLinkDto[] }>;
  evidenceSummary: EvidenceLinkDto[];
}

export interface AgentToolDefinitionDto {
  name: AgentToolName;
  description: string;
  inputSchemaName: string;
  outputSchemaName: string;
}

export interface AgentToolExecutionDto<T = unknown> {
  toolCallId: string;
  toolName: AgentToolName;
  status: "SUCCEEDED" | "FAILED";
  result?: T;
  linkedEntity?: { type: string; id: string };
  evidence: EvidenceLinkDto[];
  trace: Array<{ step: string; summary: string }>;
}

export const BusinessFoundationSchemaNames = {
  ingestPayload: "IngestPayloadZodSchema",
  skuSummary: "SkuSummaryZodSchema",
  skuDetail: "SkuDetailZodSchema",
  ruleSet: "ActivityRuleSetZodSchema",
  simulationResult: "SimulationResultZodSchema",
  dataFreshness: "DataFreshnessZodSchema",
  decisionExplanation: "DecisionExplanationZodSchema",
  reviewItem: "ReviewItemZodSchema",
  reportPreview: "ReportPreviewZodSchema",
  agentTool: "AgentToolZodSchema",
} as const;

export function assertValidIngestPayload(payload: IngestPayloadDto): void {
  if (!payload.collectedAt || Number.isNaN(Date.parse(payload.collectedAt))) {
    throw new Error("collectedAt must be an ISO datetime");
  }
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("rows must contain at least one collected SKU row");
  }
  payload.rows.forEach((row, index) => {
    for (const key of ["platform", "storeId", "externalSkuId"] as const) {
      if (!row[key]) {
        throw new Error(`rows[${index}].${key} is required`);
      }
    }
    if (!row.raw || typeof row.raw !== "object") {
      throw new Error(`rows[${index}].raw is required`);
    }
  });
}

export function assertValidRuleSet(ruleSet: ActivityRuleSetDto): void {
  if (!ruleSet.ruleSetId || !ruleSet.name || !ruleSet.sourceText) {
    throw new Error("ruleSetId, name and sourceText are required");
  }
  if (!Array.isArray(ruleSet.rules)) {
    throw new Error("rules must be an array");
  }
  ruleSet.rules.forEach((rule, index) => {
    if (!rule.id || !rule.type || !rule.message || !rule.severity) {
      throw new Error(`rules[${index}] is missing required canonical fields`);
    }
  });
}
