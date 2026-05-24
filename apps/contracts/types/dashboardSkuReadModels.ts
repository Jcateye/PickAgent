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
  skuProfileId?: string;
  externalSkuId?: string;
  productName?: string;
  storeId?: string;
  platform?: string;
  platforms?: string[];
  category?: string;
  categories?: string[];
  healthStatus?: DashboardSkuHealthStatus;
  healthStatuses?: DashboardSkuHealthStatus[];
  eligibilityStatus?: DashboardSkuEligibilityStatus;
  eligibilityStatuses?: DashboardSkuEligibilityStatus[];
  certificateStatus?: string;
  certificateStatuses?: string[];
  qualityLabel?: string;
  qualityLabels?: string[];
  sourceKind?: string;
  sourceKinds?: string[];
  minSales30d?: number;
  maxSales30d?: number;
  minPositiveRate?: number;
  maxPositiveRate?: number;
  minStock?: number;
  maxStock?: number;
  minQualityScore?: number;
  maxQualityScore?: number;
  collectedAtFrom?: string;
  collectedAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  activityId?: string;
  sortBy?: "sales30d" | "positiveRate" | "stock" | "qualityScore" | "collectedAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface DashboardSkuListItemDto {
  skuProfileId: string;
  displaySku: string;
  productName: string;
  category?: string;
  sales30d?: number;
  positiveRate?: number;
  qualityScore?: number;
  qualityLabel?: string;
  sourceKind?: string;
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
  collectedAt?: string;
  updatedAt: string;
}

export interface DashboardSkuReadinessDetailDto {
  skuProfileId: string;
  displaySku: string;
  productName: string;
  category?: string;
  platform: string;
  storeId: string;
  keyMetrics: {
    sales30d?: number;
    positiveRate?: number;
    qualityScore?: number;
    qualityLabel?: string;
    sourceKind?: string;
    stock?: number;
    collectedAt?: string;
  };
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
