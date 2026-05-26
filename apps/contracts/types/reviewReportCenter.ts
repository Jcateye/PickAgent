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

export type ReviewWorkbenchStatus = "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "DRAFT";
export type ReviewWorkbenchType = "REPLENISHMENT" | "CERTIFICATE" | "RULE_AMBIGUITY" | "ACTIVITY_CONFLICT" | "PRICE" | "AGENT_REVIEW_GATE";
export type ReviewRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ReviewPriority = "P0" | "P1" | "P2" | "P3" | "P4";

export interface ReviewListQueryDto {
  page?: number;
  pageSize?: number;
  tab?: ReviewWorkbenchStatus;
  type?: ReviewWorkbenchType;
  riskLevel?: ReviewRiskLevel;
  status?: string;
  assigneeRole?: string;
  dueFrom?: string;
  dueTo?: string;
  q?: string;
}

export interface ReviewListItemDto {
  reviewItemId: string;
  priority: ReviewPriority;
  type: ReviewWorkbenchType;
  title: string;
  summary: string;
  status: ReviewWorkbenchStatus;
  riskLevel: ReviewRiskLevel;
  assignee: {
    userId?: string;
    name: string;
    team: string;
  };
  dueAt?: string;
  evidenceSummary: string;
}

export interface ReviewDetailDto extends ReviewListItemDto {
  recommendation: {
    actionType: "REPLENISH_STOCK" | "UPLOAD_CERTIFICATE" | "CONFIRM_RULE" | "EXCLUDE_SKU" | "CONFIRM_MAPPING";
    content: string;
    expectedEffect?: string;
    metrics?: Array<{ label: string; value: string | number }>;
  };
  riskIfIgnored: string;
  evidenceRefs: EvidenceRef[];
  relatedRules: TraceableRef[];
  relatedRun?: TraceableRef;
  approvalHistory: Array<{
    actor: string;
    action: string;
    comment?: string;
    createdAt: string;
    workflowRunId?: string;
  }>;
}

export interface ReviewDecisionRequestDto {
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  decisionBy: string;
  decisionComment?: string;
  modifiedPayload?: Record<string, unknown>;
}

export interface ReportDetailDto {
  reportId: string;
  title: string;
  version: string;
  status: "GENERATING" | "PREVIEW" | "COMPLETED" | "FAILED";
  activity?: TraceableRef;
  sourceRun?: TraceableRef;
  generatedAt: string;
  activityWindow?: { startAt: string; endAt: string };
  tabs: Array<"SUMMARY" | "TASKS" | "RULES" | "EVIDENCE" | "REPAIRS">;
  summary: {
    totalSku: number;
    passedSku: number;
    repairableSku: number;
    blockedSku: number;
    categoryDistribution: Array<{
      category: string;
      passed: number;
      repairable: number;
      blocked: number;
      passRate: number;
    }>;
    majorRisks: Array<{
      riskType: string;
      affectedSku: number;
      ratio: number;
      sampleIssue: string;
    }>;
    repairSuggestions: Array<{
      priority: "P0" | "P1" | "P2";
      suggestion: string;
      affectedSku: number;
      estimatedLift: string;
    }>;
    reviewResult: {
      total: number;
      completed: number;
      approved: number;
      rejected: number;
    };
  };
  evidenceSummary: EvidenceRef[];
  subscription?: ReportSubscriptionDto;
}

export interface ReportListItemDto {
  reportId: string;
  title: string;
  version: string;
  status: ReportDetailDto["status"];
  generatedAt: string;
  sourceRun?: TraceableRef;
  exportStatus: "NONE" | "PENDING" | "READY" | "FAILED";
}

export interface ReportVersionDto extends ReportDetailDto {
  versionId: string;
}

export interface ReportComparisonDto {
  comparisonId: string;
  baseReportId: string;
  targetReportId: string;
  baseTitle: string;
  targetTitle: string;
  generatedAt: string;
  metrics: {
    basePassRate: number;
    targetPassRate: number;
    deltaPassRate: number;
    deltaPassedSku: number;
    deltaRepairableSku: number;
    deltaBlockedSku: number;
  };
  summary: string;
  evidenceSummary: EvidenceRef[];
  workflowRunId?: string;
}

export interface ReportExportRequestDto {
  format: "PDF" | "EXCEL" | "PPT";
  idempotencyKey?: string;
  includeCharts?: boolean;
  includeDetails?: boolean;
}

export interface ReportExportJobDto {
  exportJobId: string;
  reportId: string;
  status: "PENDING";
  format: ReportExportRequestDto["format"];
  includeCharts: boolean;
  includeDetails: boolean;
  requestedAt: string;
  workflowRunId?: string;
}

export interface ReportSubscriptionRequestDto {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "OFF";
  recipients: string[];
}

export interface ReportSubscriptionDto extends ReportSubscriptionRequestDto {
  reportId: string;
  updatedAt: string;
  workflowRunId?: string;
}
