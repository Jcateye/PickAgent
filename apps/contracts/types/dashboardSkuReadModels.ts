export type DashboardSkuHealthStatus = "READY" | "REPAIRABLE" | "RISKY" | "BLOCKED";
export type DashboardSkuEligibilityStatus = "DIRECT_READY" | "REPAIRABLE_READY" | "MANUAL_REVIEW" | "BLOCKED";

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

export interface DashboardSkuListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  platform?: string;
  category?: string;
  healthStatus?: DashboardSkuHealthStatus;
  eligibilityStatus?: DashboardSkuEligibilityStatus;
  certificateStatus?: string;
  activityId?: string;
  sortBy?: "sales30d" | "positiveRate" | "stock" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface DashboardSkuListItemDto {
  skuProfileId: string;
  displaySku: string;
  productName: string;
  category?: string;
  sales30d?: number;
  positiveRate?: number;
  stock?: number;
  healthStatus: DashboardSkuHealthStatus;
  eligibilityStatus?: DashboardSkuEligibilityStatus;
  eligibilityLabel: string;
  nextAction: {
    type: "JOIN_ACTIVITY" | "REPAIR_ISSUE" | "VIEW_DETAIL" | "VIEW_BLOCKER" | "MANUAL_REVIEW";
    label: string;
    disabled?: boolean;
  };
  evidenceCount: number;
  updatedAt: string;
}

export interface DashboardSkuReadinessDetailDto {
  skuProfileId: string;
  displaySku: string;
  productName: string;
  category?: string;
  platform: string;
  storeId: string;
  statusSummary: {
    healthStatus: DashboardSkuHealthStatus;
    eligibilityStatus?: DashboardSkuEligibilityStatus;
    conclusion: string;
    nextStep: string;
  };
  readinessChecklist: Array<{
    id: string;
    label: string;
    status: "PASSED" | "FAILED" | "MISSING_DATA" | "MANUAL_REVIEW";
    evidenceRefs: EvidenceRef[];
  }>;
  evidenceOverview: {
    documentCount: number;
    dataCheckPassedCount: number;
    imageEvidenceCount: number;
    manualConfirmationCount: number;
  };
  latestSnapshot: Record<string, unknown> | null;
  latestDiagnosis: {
    diagnosisId: string;
    healthStatus: DashboardSkuHealthStatus;
    healthScore: number;
    dataQualityScore: number;
    issues: string[];
    nextActions: string[];
    diagnosedAt: string;
    evidenceRefs: EvidenceRef[];
  } | null;
  relatedRules: TraceableRef[];
  relatedReviews: TraceableRef[];
}
