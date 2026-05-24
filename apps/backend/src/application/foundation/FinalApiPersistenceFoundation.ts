import {
  type ActivityRuleSetDto,
  type CanonicalRuleDto,
  type EvidenceLinkDto,
  type HealthDiagnosisDto,
  type IngestPayloadDto,
  type IngestRowDto,
  type NormalizedSkuSnapshotDto,
  type ReportPreviewDto,
  type ReviewDecision,
  type ReviewItemDto,
  type SimulationEligibility,
  type SimulationRequestDto,
  type SimulationResultDto,
  type SkuDetailDto,
  type SkuSummaryDto,
  assertValidIngestPayload,
  assertValidRuleSet,
} from "../../../../contracts/types/businessFoundation";
import type {
  DashboardSkuEligibilityStatus,
  DashboardSkuHealthStatus,
  DashboardSkuListItemDto,
  DashboardSkuListQuery,
  DashboardSkuReadinessDetailDto,
} from "../../../../contracts/types/dashboardSkuReadModels";
import {
  type ActivityDto,
  type ActivityExecutionPlanDto,
  type ActivitySimulationRunDetailDto,
  type CreateActivityRequestDto,
  type EvidenceRef,
  type ParseActivityRuleSetRequestDto,
  type RequiredFieldStatus,
  type TraceableRef,
  type UpdateActivityRequestDto,
} from "../../../../contracts/types/activityManagement";
import type {
  ReportDetailDto,
  ReportExportJobDto,
  ReportExportRequestDto,
  ReportListItemDto,
  ReportSubscriptionDto,
  ReportSubscriptionRequestDto,
  ReportVersionDto,
  ReviewDetailDto,
  ReviewListItemDto,
  ReviewListQueryDto,
  ReviewWorkbenchStatus,
} from "../../../../contracts/types/reviewReportCenter";
import { HealthAssessmentService, NormalizationService } from "./BusinessFoundationServices";
import { assertTenantBoundary, type P0AuthContextDto } from "./P0AuthBoundaryRuntimeConfig";

declare const process: { env: Record<string, string | undefined> };

export interface ApiEnvelope<T> {
  code: "OK" | "COMMON.VALIDATION_ERROR" | "SKU.NOT_FOUND" | "RULE.PARSE_FAILED" | "REVIEW.NOT_FOUND" | "REPORT.NOT_FOUND" | "AGENT.REAL_CHAT_NOT_CONFIGURED";
  message: string;
  data: T | null;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface HealthSummaryDto {
  total: number;
  ready: number;
  warning: number;
  blocked: number;
}

export interface IngestResponseDto {
  summaries: SkuSummaryDto[];
  snapshots: NormalizedSkuSnapshotDto[];
  diagnoses: HealthDiagnosisDto[];
  workflowRunId: string;
}

export interface ActivitySimulationRunDto {
  simulationRunId: string;
  activityRuleSetId: string;
  status: "SUCCEEDED";
  scope: { skuProfileIds: string[]; whatIf?: SimulationRequestDto["whatIf"] };
  results: SimulationResultDto[];
  startedAt: string;
  completedAt: string;
}

export interface ReviewDecisionRequestDto {
  decision: ReviewDecision;
  decisionBy: string;
  decisionComment?: string;
  modifiedPayload?: Record<string, unknown>;
}

export interface ReportRequestDto {
  type: "HEALTH" | "ACTIVITY";
  skuProfileIds: string[];
  simulationResultIds?: string[];
}

interface DashboardSkuReadModelRecord {
  summary: SkuSummaryDto;
  latestSnapshot: NormalizedSkuSnapshotDto | null;
  latestDiagnosis: HealthDiagnosisDto | null;
  latestSimulationResult: SimulationResultDto | null;
  relatedReviews: ReviewItemDto[];
  updatedAt: string;
}

const explicitDevBoundary: P0AuthContextDto = {
  actorId: "dev_actor",
  tenantId: "dev_tenant",
  sessionId: "dev_session",
  surface: "api-dev-fallback",
  requestId: "dev_request",
};

interface SkuProfileRecord {
  skuProfileId: string;
  canonicalSkuKey: string;
  platform: string;
  storeId: string;
  externalSkuId: string;
  productName: string;
  category?: string;
  brand?: string;
}

interface WorkflowAuditRecord {
  workflowRunId: string;
  workflowType: string;
  status: "SUCCEEDED";
  subjectType?: string;
  subjectId?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  createdAt: string;
}

export interface PersistenceBoundary {
  tenantId?: string;
  sessionId?: string;
  actorId?: string;
}

type PrismaDelegate = {
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  count(args?: Record<string, unknown>): Promise<number>;
};

export interface PrismaPersistenceClient {
  $transaction<T>(work: (tx: PrismaPersistenceClient) => Promise<T>): Promise<T>;
  skuProfile: PrismaDelegate;
  skuSnapshot: PrismaDelegate;
  skuHealthDiagnosis: PrismaDelegate;
  currentSkuProjection: PrismaDelegate;
  activity: PrismaDelegate;
  activityRuleSet: PrismaDelegate;
  activitySimulationRun: PrismaDelegate;
  activitySimulationResult: PrismaDelegate;
  reviewItem: PrismaDelegate;
  workflowRun: PrismaDelegate;
  workflowStep: PrismaDelegate;
  report?: PrismaDelegate;
  reportVersion?: PrismaDelegate;
}

export class FinalApiPersistenceStore {
  readonly profilesByCanonicalKey = new Map<string, SkuProfileRecord>();
  readonly profilesById = new Map<string, SkuProfileRecord>();
  readonly activities = new Map<string, ActivityDto>();
  readonly activityRuleSetByActivityId = new Map<string, string>();
  readonly latestSimulationRunByActivityId = new Map<string, string>();
  readonly snapshots = new Map<string, NormalizedSkuSnapshotDto>();
  readonly diagnoses = new Map<string, HealthDiagnosisDto>();
  readonly projections = new Map<string, SkuSummaryDto>();
  readonly ruleSets = new Map<string, ActivityRuleSetDto>();
  readonly simulationRuns = new Map<string, ActivitySimulationRunDto>();
  readonly simulationResults = new Map<string, SimulationResultDto>();
  readonly reviews = new Map<string, ReviewItemDto>();
  readonly reports = new Map<string, ReportPreviewDto>();
  readonly reportDetails = new Map<string, ReportDetailDto>();
  readonly reportVersions = new Map<string, ReportVersionDto[]>();
  readonly reportExports = new Map<string, ReportExportJobDto>();
  readonly reportSubscriptions = new Map<string, ReportSubscriptionDto>();
  readonly workflowAudits = new Map<string, WorkflowAuditRecord>();
  readonly tenantByEntityId = new Map<string, string>();
}

export interface TransactionContext {
  readonly store?: FinalApiPersistenceStore;
  readonly prisma?: PrismaPersistenceClient;
  readonly boundary?: PersistenceBoundary;
}

export interface TransactionManager {
  transaction<T>(work: (tx: TransactionContext) => T | Promise<T>): Promise<T>;
}

export class InMemoryTransactionManager implements TransactionManager {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  async transaction<T>(work: (tx: TransactionContext) => T | Promise<T>): Promise<T> {
    return work({ store: this.store });
  }
}

export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly prisma: PrismaPersistenceClient, private readonly boundary: PersistenceBoundary = {}) {}

  transaction<T>(work: (tx: TransactionContext) => T | Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (prisma) => work({ prisma, boundary: this.boundary }));
  }
}

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString().padStart(4, "0")}`;
}

function nextUuid(): string {
  return "10000000-1000-4000-8000-".replace(/[018]/g, (char) => (Number(char) ^ Math.floor(Math.random() * 16)).toString(16)) + Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, "0").slice(0, 12);
}

function canonicalSkuKey(row: IngestRowDto): string {
  return `${row.platform}:${row.storeId}:${row.externalSkuId}`;
}

function evidence(type: "snapshot" | "diagnosis" | "rule" | "simulation" | "review" | "report" | "tool_trace", entityId: string, label: string, summary: string) {
  return { type, entityId, label, summary };
}

export class IngestRepository {
  findSkuProfileIdByCanonicalKey(tx: TransactionContext, key: string): string | null | Promise<string | null> {
    return tx.store!.profilesByCanonicalKey.get(key)?.skuProfileId ?? null;
  }

  upsertIngestAggregate(
    tx: TransactionContext,
    input: { boundary: P0AuthContextDto; row: IngestRowDto; collectedAt: string; snapshot: NormalizedSkuSnapshotDto; diagnosis: HealthDiagnosisDto },
  ): SkuSummaryDto | Promise<SkuSummaryDto> {
    const key = canonicalSkuKey(input.row);
    const existingProfile = tx.store!.profilesByCanonicalKey.get(key);
    if (existingProfile) assertTenantBoundary(input.boundary, tx.store!.tenantByEntityId.get(existingProfile.skuProfileId), existingProfile.skuProfileId);
    const profile =
      existingProfile ??
      ({
        skuProfileId: input.snapshot.skuProfileId,
        canonicalSkuKey: key,
        platform: input.row.platform,
        storeId: input.row.storeId,
        externalSkuId: input.row.externalSkuId,
        productName: input.snapshot.productName,
        category: input.row.category,
        brand: input.row.brand,
      } satisfies SkuProfileRecord);

    const updatedProfile = { ...profile, productName: input.snapshot.productName, category: input.row.category ?? profile.category, brand: input.row.brand ?? profile.brand };
    const summary = toSummary(updatedProfile, input.diagnosis);
    tx.store!.profilesByCanonicalKey.set(key, updatedProfile);
    tx.store!.profilesById.set(updatedProfile.skuProfileId, updatedProfile);
    tx.store!.snapshots.set(input.snapshot.snapshotId, input.snapshot);
    tx.store!.diagnoses.set(input.diagnosis.diagnosisId, input.diagnosis);
    tx.store!.projections.set(updatedProfile.skuProfileId, summary);
    for (const entityId of [updatedProfile.skuProfileId, input.snapshot.snapshotId, input.diagnosis.diagnosisId]) {
      tx.store!.tenantByEntityId.set(entityId, input.boundary.tenantId);
    }
    return summary;
  }

  recordWorkflowAudit(tx: TransactionContext, boundary: P0AuthContextDto, record: Omit<WorkflowAuditRecord, "workflowRunId" | "createdAt" | "status">): WorkflowAuditRecord | Promise<WorkflowAuditRecord> {
    const audit: WorkflowAuditRecord = { ...record, workflowRunId: nextId("workflow"), status: "SUCCEEDED", createdAt: new Date().toISOString() };
    tx.store!.workflowAudits.set(audit.workflowRunId, audit);
    tx.store!.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return audit;
  }
}

export class SkuQueryRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  healthSummary(boundary: P0AuthContextDto): HealthSummaryDto | Promise<HealthSummaryDto> {
    const summaries = Array.from(this.store.projections.values()).filter((item) => this.belongsToTenant(boundary, item.skuProfileId));
    return {
      total: summaries.length,
      ready: summaries.filter((item) => item.healthStatus === "READY").length,
      warning: summaries.filter((item) => item.healthStatus === "WARNING").length,
      blocked: summaries.filter((item) => item.healthStatus === "BLOCKED").length,
    };
  }

  list(boundary: P0AuthContextDto, page = 1, pageSize = 20): PageDto<SkuSummaryDto> | Promise<PageDto<SkuSummaryDto>> {
    const items = Array.from(this.store.projections.values()).filter((item) => this.belongsToTenant(boundary, item.skuProfileId));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
  }

  detail(boundary: P0AuthContextDto, skuProfileId: string): SkuDetailDto | null | Promise<SkuDetailDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(skuProfileId), skuProfileId);
    const summary = this.store.projections.get(skuProfileId);
    if (!summary) return null;
    const latestSnapshot = Array.from(this.store.snapshots.values()).filter((item) => item.skuProfileId === skuProfileId).at(-1) ?? null;
    const latestDiagnosis = Array.from(this.store.diagnoses.values()).filter((item) => item.skuProfileId === skuProfileId).at(-1) ?? null;
    return {
      ...summary,
      latestSnapshot,
      latestDiagnosis,
      evidence: [
        ...(latestSnapshot ? [evidence("snapshot", latestSnapshot.snapshotId, "采集事实", "当前 DTO 由 repository 读模型装配")] : []),
        ...(latestDiagnosis ? [evidence("diagnosis", latestDiagnosis.diagnosisId, "健康诊断", "当前 DTO 由 repository 读模型装配")] : []),
      ],
    };
  }

  private belongsToTenant(boundary: P0AuthContextDto, entityId: string): boolean {
    return this.store.tenantByEntityId.get(entityId) === boundary.tenantId;
  }
}

export class DashboardSkuReadModelRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  async list(boundary: P0AuthContextDto): Promise<DashboardSkuReadModelRecord[]> {
    return Array.from(this.store.projections.values())
      .filter((item) => this.belongsToTenant(boundary, item.skuProfileId))
      .map((summary) => this.toRecord(summary));
  }

  async detail(boundary: P0AuthContextDto, skuProfileId: string): Promise<DashboardSkuReadModelRecord | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(skuProfileId), skuProfileId);
    const summary = this.store.projections.get(skuProfileId);
    return summary ? this.toRecord(summary) : null;
  }

  private toRecord(summary: SkuSummaryDto): DashboardSkuReadModelRecord {
    const latestSnapshot = Array.from(this.store.snapshots.values()).filter((item) => item.skuProfileId === summary.skuProfileId).at(-1) ?? null;
    const latestDiagnosis = Array.from(this.store.diagnoses.values()).filter((item) => item.skuProfileId === summary.skuProfileId).at(-1) ?? null;
    const latestSimulationResult = Array.from(this.store.simulationResults.values()).filter((item) => item.skuProfileId === summary.skuProfileId).at(-1) ?? null;
    const relatedReviews = Array.from(this.store.reviews.values()).filter((item) => item.skuProfileId === summary.skuProfileId);
    return {
      summary,
      latestSnapshot,
      latestDiagnosis,
      latestSimulationResult,
      relatedReviews,
      updatedAt: latestDiagnosis?.diagnosedAt ?? latestSnapshot?.collectedAt ?? new Date(0).toISOString(),
    };
  }

  private belongsToTenant(boundary: P0AuthContextDto, entityId: string): boolean {
    return this.store.tenantByEntityId.get(entityId) === boundary.tenantId;
  }
}

export class ActivityRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  listActivities(boundary: P0AuthContextDto, page = 1, pageSize = 20): PageDto<ActivityDto> | Promise<PageDto<ActivityDto>> {
    const items = Array.from(this.store.activities.values()).filter((item) => this.store.tenantByEntityId.get(item.activityId) === boundary.tenantId);
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
  }

  getActivity(boundary: P0AuthContextDto, activityId: string): ActivityDto | null | Promise<ActivityDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(activityId), activityId);
    return this.store.activities.get(activityId) ?? null;
  }

  async createActivity(boundary: P0AuthContextDto, input: CreateActivityRequestDto): Promise<ActivityDto> {
    const now = new Date().toISOString();
    const activity: ActivityDto = {
      activityId: nextId("activity"),
      name: input.name,
      platform: input.platform,
      categoryScope: input.categoryScope,
      productScopeText: input.productScopeText ?? "全部当前 SKU",
      status: "DRAFT",
      startAt: input.startAt,
      endAt: input.endAt,
      createdAt: now,
      updatedAt: now,
    };
    this.store.activities.set(activity.activityId, activity);
    this.store.tenantByEntityId.set(activity.activityId, boundary.tenantId);
    const audit = await this.recordWorkflowAudit(boundary, "activity_create", activity.activityId, { input }, { activityId: activity.activityId });
    const audited = { ...activity, latestRunId: audit.entityId };
    this.store.activities.set(activity.activityId, audited);
    return audited;
  }

  async updateActivity(boundary: P0AuthContextDto, activityId: string, input: UpdateActivityRequestDto): Promise<ActivityDto> {
    const current = this.getActivity(boundary, activityId) as ActivityDto | null;
    if (!current) throw new Error(`Activity not found: ${activityId}`);
    const updated: ActivityDto = {
      ...current,
      ...stripUndefined({
        name: input.name,
        platform: input.platform,
        categoryScope: input.categoryScope,
        productScopeText: input.productScopeText,
        status: input.status,
        startAt: input.startAt === null ? undefined : input.startAt,
        endAt: input.endAt === null ? undefined : input.endAt,
      }),
      updatedAt: new Date().toISOString(),
    };
    this.store.activities.set(activityId, updated);
    const audit = await this.recordWorkflowAudit(boundary, "activity_update", activityId, { input }, { activityId });
    const audited = { ...updated, latestRunId: audit.entityId };
    this.store.activities.set(activityId, audited);
    return audited;
  }

  bindRuleSetToActivity(boundary: P0AuthContextDto, activityId: string, ruleSetId: string): ActivityDto | Promise<ActivityDto> {
    const current = this.getActivity(boundary, activityId) as ActivityDto | null;
    if (!current) throw new Error(`Activity not found: ${activityId}`);
    const updated = { ...current, currentRuleSetId: ruleSetId, updatedAt: new Date().toISOString() };
    this.store.activities.set(activityId, updated);
    this.store.activityRuleSetByActivityId.set(activityId, ruleSetId);
    return updated;
  }

  saveRuleSet(boundary: P0AuthContextDto, ruleSet: ActivityRuleSetDto): ActivityRuleSetDto | Promise<ActivityRuleSetDto> {
    this.store.ruleSets.set(ruleSet.ruleSetId, ruleSet);
    this.store.tenantByEntityId.set(ruleSet.ruleSetId, boundary.tenantId);
    return ruleSet;
  }

  getRuleSet(boundary: P0AuthContextDto, activityRuleSetId: string): ActivityRuleSetDto | null | Promise<ActivityRuleSetDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(activityRuleSetId), activityRuleSetId);
    return this.store.ruleSets.get(activityRuleSetId) ?? null;
  }

  saveSimulationRun(boundary: P0AuthContextDto, run: ActivitySimulationRunDto): ActivitySimulationRunDto | Promise<ActivitySimulationRunDto> {
    this.store.simulationRuns.set(run.simulationRunId, run);
    this.store.tenantByEntityId.set(run.simulationRunId, boundary.tenantId);
    for (const result of run.results) {
      this.store.simulationResults.set(result.simulationResultId, result);
      this.store.tenantByEntityId.set(result.simulationResultId, boundary.tenantId);
    }
    return run;
  }

  bindSimulationRunToActivity(boundary: P0AuthContextDto, activityId: string, simulationRunId: string): ActivityDto | Promise<ActivityDto> {
    const current = this.getActivity(boundary, activityId) as ActivityDto | null;
    if (!current) throw new Error(`Activity not found: ${activityId}`);
    const updated = { ...current, latestRunId: simulationRunId, status: "RUNNING" as const, updatedAt: new Date().toISOString() };
    this.store.activities.set(activityId, updated);
    this.store.latestSimulationRunByActivityId.set(activityId, simulationRunId);
    return updated;
  }

  getSimulationRun(boundary: P0AuthContextDto, simulationRunId: string): ActivitySimulationRunDto | null | Promise<ActivitySimulationRunDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(simulationRunId), simulationRunId);
    return this.store.simulationRuns.get(simulationRunId) ?? null;
  }

  recordWorkflowAudit(boundary: P0AuthContextDto, workflowType: string, subjectId: string, input: Record<string, unknown>, output: Record<string, unknown>): TraceableRef | Promise<TraceableRef> {
    const workflowRunId = nextId("workflow");
    this.store.workflowAudits.set(workflowRunId, { workflowRunId, workflowType, status: "SUCCEEDED", subjectType: "activity", subjectId, input, output, createdAt: new Date().toISOString() });
    this.store.tenantByEntityId.set(workflowRunId, boundary.tenantId);
    return traceRef("workflow_run", workflowRunId, "Workflow audit");
  }
}

export class ReviewRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  list(boundary: P0AuthContextDto, query: ReviewListQueryDto = {}): ReviewItemDto[] | Promise<ReviewItemDto[]> {
    const q = query.q?.trim().toLowerCase();
    return Array.from(this.store.reviews.values()).filter((item) => {
      if (this.store.tenantByEntityId.get(item.reviewItemId) !== boundary.tenantId) return false;
      const assembled = toReviewListItem(item);
      if (query.tab && assembled.status !== query.tab) return false;
      if (query.type && assembled.type !== query.type) return false;
      if (query.riskLevel && assembled.riskLevel !== query.riskLevel) return false;
      if (query.status && assembled.status !== query.status) return false;
      if (q && !`${assembled.title} ${assembled.summary} ${item.question}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  create(boundary: P0AuthContextDto, items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): ReviewItemDto[] | Promise<ReviewItemDto[]> {
    return items.map((item) => {
      if (item.skuProfileId) assertTenantBoundary(boundary, this.store.tenantByEntityId.get(item.skuProfileId), item.skuProfileId);
      const review: ReviewItemDto = { ...item, reviewItemId: nextId("review"), status: "OPEN" };
      this.store.reviews.set(review.reviewItemId, review);
      this.store.tenantByEntityId.set(review.reviewItemId, boundary.tenantId);
      const audit: WorkflowAuditRecord = {
        workflowRunId: nextId("workflow"),
        workflowType: "review_create",
        status: "SUCCEEDED",
        subjectType: "review_item",
        subjectId: review.reviewItemId,
        input: { actorId: boundary.actorId, sourceType: item.sourceType, sourceId: item.sourceId },
        output: { reviewItemId: review.reviewItemId, status: review.status },
        createdAt: new Date().toISOString(),
      };
      this.store.workflowAudits.set(audit.workflowRunId, audit);
      this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
      return review;
    });
  }

  getById(boundary: P0AuthContextDto, reviewItemId: string): ReviewItemDto | null | Promise<ReviewItemDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reviewItemId), reviewItemId);
    return this.store.reviews.get(reviewItemId) ?? null;
  }

  update(boundary: P0AuthContextDto, reviewItemId: string, patch: Partial<Pick<ReviewItemDto, "question" | "recommendation" | "riskLevel">>): ReviewItemDto | Promise<ReviewItemDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reviewItemId), reviewItemId);
    const current = this.store.reviews.get(reviewItemId);
    if (!current) throw new Error(`Review item not found: ${reviewItemId}`);
    const updated = { ...current, ...patch };
    this.store.reviews.set(reviewItemId, updated);
    const audit: WorkflowAuditRecord = {
      workflowRunId: nextId("workflow"),
      workflowType: "review_update",
      status: "SUCCEEDED",
      subjectType: "review_item",
      subjectId: reviewItemId,
      input: { actorId: boundary.actorId, patch },
      output: { reviewItemId, status: updated.status },
      createdAt: new Date().toISOString(),
    };
    this.store.workflowAudits.set(audit.workflowRunId, audit);
    this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return updated;
  }

  decide(boundary: P0AuthContextDto, reviewItemId: string, request: ReviewDecisionRequestDto): ReviewItemDto | Promise<ReviewItemDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reviewItemId), reviewItemId);
    const current = this.store.reviews.get(reviewItemId);
    if (!current) throw new Error(`Review item not found: ${reviewItemId}`);
    const statusByDecision = { APPROVE: "APPROVED", REJECT: "REJECTED", REQUEST_CHANGES: "CHANGES_REQUESTED" } as const;
    const updated: ReviewItemDto = { ...current, status: statusByDecision[request.decision], decision: request.decision, decisionBy: request.decisionBy, decisionComment: request.decisionComment, decidedAt: new Date().toISOString() };
    this.store.reviews.set(reviewItemId, updated);
    const audit: WorkflowAuditRecord = {
      workflowRunId: nextId("workflow"),
      workflowType: "review_decision",
      status: "SUCCEEDED",
      subjectType: "review_item",
      subjectId: reviewItemId,
      input: { actorId: boundary.actorId, decision: request.decision, modifiedPayload: request.modifiedPayload },
      output: { reviewItemId, status: updated.status },
      createdAt: updated.decidedAt ?? new Date().toISOString(),
    };
    this.store.workflowAudits.set(audit.workflowRunId, audit);
    this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return updated;
  }

  approvalHistory(boundary: P0AuthContextDto, reviewItemId: string): ReviewDetailDto["approvalHistory"] | Promise<ReviewDetailDto["approvalHistory"]> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reviewItemId), reviewItemId);
    return Array.from(this.store.workflowAudits.values())
      .filter((audit) => audit.subjectType === "review_item" && audit.subjectId === reviewItemId)
      .map((audit) => ({
        actor: String(audit.input.actorId ?? "system"),
        action: audit.workflowType,
        comment: typeof audit.input.decision === "string" ? String(audit.input.decision) : undefined,
        createdAt: audit.createdAt,
      }));
  }
}

export class ReportRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  save(boundary: P0AuthContextDto, report: ReportPreviewDto): ReportPreviewDto | Promise<ReportPreviewDto> {
    this.store.reports.set(report.reportId, report);
    this.store.tenantByEntityId.set(report.reportId, boundary.tenantId);
    return report;
  }

  saveDetail(boundary: P0AuthContextDto, detail: ReportDetailDto): ReportDetailDto | Promise<ReportDetailDto> {
    this.store.reportDetails.set(detail.reportId, detail);
    this.store.tenantByEntityId.set(detail.reportId, boundary.tenantId);
    const version: ReportVersionDto = { ...detail, versionId: nextId("report_version") };
    this.store.reportVersions.set(detail.reportId, [version, ...(this.store.reportVersions.get(detail.reportId) ?? [])]);
    this.store.tenantByEntityId.set(version.versionId, boundary.tenantId);
    const audit: WorkflowAuditRecord = {
      workflowRunId: nextId("workflow"),
      workflowType: "report_snapshot",
      status: "SUCCEEDED",
      subjectType: "report",
      subjectId: detail.reportId,
      input: { actorId: boundary.actorId, title: detail.title },
      output: { reportId: detail.reportId, versionId: version.versionId, version: version.version },
      createdAt: detail.generatedAt,
    };
    this.store.workflowAudits.set(audit.workflowRunId, audit);
    this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return detail;
  }

  list(boundary: P0AuthContextDto): ReportDetailDto[] | Promise<ReportDetailDto[]> {
    return Array.from(this.store.reportDetails.values()).filter((item) => this.store.tenantByEntityId.get(item.reportId) === boundary.tenantId);
  }

  getById(boundary: P0AuthContextDto, reportId: string): ReportDetailDto | null | Promise<ReportDetailDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    return this.store.reportDetails.get(reportId) ?? null;
  }

  listVersions(boundary: P0AuthContextDto, reportId: string): ReportVersionDto[] | Promise<ReportVersionDto[]> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    return this.store.reportVersions.get(reportId) ?? [];
  }

  getVersion(boundary: P0AuthContextDto, reportId: string, versionId: string): ReportVersionDto | null | Promise<ReportVersionDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    return (this.store.reportVersions.get(reportId) ?? []).find((item) => item.versionId === versionId) ?? null;
  }

  createExport(boundary: P0AuthContextDto, reportId: string, request: ReportExportRequestDto): ReportExportJobDto | Promise<ReportExportJobDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    const key = request.idempotencyKey ? `${reportId}:${request.idempotencyKey}` : "";
    const existing = key ? this.store.reportExports.get(key) : undefined;
    if (existing) return existing;
    const job: ReportExportJobDto = { exportJobId: nextId("export"), reportId, status: "PENDING", format: request.format, requestedAt: new Date().toISOString() };
    this.store.reportExports.set(key || job.exportJobId, job);
    return job;
  }

  saveSubscription(boundary: P0AuthContextDto, reportId: string, request: ReportSubscriptionRequestDto): ReportSubscriptionDto | Promise<ReportSubscriptionDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    const subscription = { ...request, reportId, updatedAt: new Date().toISOString() };
    this.store.reportSubscriptions.set(reportId, subscription);
    return subscription;
  }

  getSimulationResult(boundary: P0AuthContextDto, id: string): SimulationResultDto | null | Promise<SimulationResultDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(id), id);
    return this.store.simulationResults.get(id) ?? null;
  }
}

export class PrismaIngestRepository extends IngestRepository {
  async findSkuProfileIdByCanonicalKey(tx: TransactionContext, key: string): Promise<string | null> {
    if (!tx.prisma) throw new Error("Prisma transaction context is required");
    const profile = await tx.prisma.skuProfile.findUnique({ where: { canonicalKey: key } });
    return profile ? String(profile.id) : null;
  }

  async upsertIngestAggregate(
    tx: TransactionContext,
    input: { boundary: P0AuthContextDto; row: IngestRowDto; collectedAt: string; snapshot: NormalizedSkuSnapshotDto; diagnosis: HealthDiagnosisDto },
  ): Promise<SkuSummaryDto> {
    if (!tx.prisma) throw new Error("Prisma transaction context is required");
    const key = canonicalSkuKey(input.row);
    const profile = await tx.prisma.skuProfile.upsert({
      where: { canonicalKey: key },
      create: {
        id: input.snapshot.skuProfileId,
        canonicalKey: key,
        platform: input.row.platform,
        storeId: input.row.storeId,
        externalSkuId: input.row.externalSkuId,
        productName: input.snapshot.productName,
        category: input.row.category,
        brand: input.row.brand,
      },
      update: {
        productName: input.snapshot.productName,
        category: input.row.category,
        brand: input.row.brand,
      },
    });
    const skuProfileId = String(profile.id);
    const snapshot = await tx.prisma.skuSnapshot.create({
      data: {
        id: input.snapshot.snapshotId,
        skuProfileId,
        collectedAt: new Date(input.collectedAt),
        productName: input.snapshot.productName,
        category: input.snapshot.category,
        sales30d: input.snapshot.sales30d,
        positiveRate: input.snapshot.positiveRate,
        stock: input.snapshot.stock,
        originalPrice: input.snapshot.originalPrice,
        lowestPrice30d: input.snapshot.lowestPrice30d,
        campaignPrice: input.snapshot.campaignPrice,
        joinedBrandDay: input.snapshot.joinedBrandDay,
        certificateStatus: input.snapshot.certificateStatus,
        rawJson: input.row.raw ?? {},
        normalizedJson: input.snapshot,
      },
    });
    const diagnosis = await tx.prisma.skuHealthDiagnosis.create({
      data: {
        id: input.diagnosis.diagnosisId,
        skuProfileId,
        snapshotId: String(snapshot.id),
        healthStatus: toPrismaHealthStatus(input.diagnosis.healthStatus),
        healthScore: input.diagnosis.healthScore,
        dataQualityScore: input.diagnosis.dataQualityScore,
        issuesJson: input.diagnosis.issues,
        nextActionsJson: input.diagnosis.nextActions,
        evidenceJson: input.diagnosis.evidence,
      },
    });
    await tx.prisma.currentSkuProjection.upsert({
      where: { skuProfileId },
      create: {
        skuProfileId,
        latestSnapshotId: String(snapshot.id),
        latestDiagnosisId: String(diagnosis.id),
        healthStatus: toPrismaHealthStatus(input.diagnosis.healthStatus),
        healthScore: input.diagnosis.healthScore,
        dataQualityScore: input.diagnosis.dataQualityScore,
        topIssuesJson: input.diagnosis.issues.slice(0, 3),
      },
      update: {
        latestSnapshotId: String(snapshot.id),
        latestDiagnosisId: String(diagnosis.id),
        healthStatus: toPrismaHealthStatus(input.diagnosis.healthStatus),
        healthScore: input.diagnosis.healthScore,
        dataQualityScore: input.diagnosis.dataQualityScore,
        topIssuesJson: input.diagnosis.issues.slice(0, 3),
      },
    });
    return toSummary(
      {
        skuProfileId,
        canonicalSkuKey: key,
        platform: input.row.platform,
        storeId: input.row.storeId,
        externalSkuId: input.row.externalSkuId,
        productName: input.snapshot.productName,
        category: input.row.category,
        brand: input.row.brand,
      },
      input.diagnosis,
    );
  }

  async recordWorkflowAudit(tx: TransactionContext, _boundary: P0AuthContextDto, record: Omit<WorkflowAuditRecord, "workflowRunId" | "createdAt" | "status">): Promise<WorkflowAuditRecord> {
    if (!tx.prisma) throw new Error("Prisma transaction context is required");
    const workflowRunId = nextUuid();
    const createdAt = new Date();
    await tx.prisma.workflowRun.create({
      data: {
        id: workflowRunId,
        workflowType: record.workflowType,
        status: "SUCCEEDED",
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        inputJson: record.input,
        outputJson: record.output,
        startedAt: createdAt,
        completedAt: createdAt,
      },
    });
    return { ...record, workflowRunId, status: "SUCCEEDED", createdAt: createdAt.toISOString() };
  }
}

export class PrismaSkuQueryRepository extends SkuQueryRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async healthSummary(_boundary: P0AuthContextDto): Promise<HealthSummaryDto> {
    const rows = await this.prisma.currentSkuProjection.findMany();
    return {
      total: rows.length,
      ready: rows.filter((item) => item.healthStatus === "READY").length,
      warning: rows.filter((item) => item.healthStatus === "REPAIRABLE" || item.healthStatus === "RISKY").length,
      blocked: rows.filter((item) => item.healthStatus === "BLOCKED").length,
    };
  }

  async list(_boundary: P0AuthContextDto, page = 1, pageSize = 20): Promise<PageDto<SkuSummaryDto>> {
    const rows = await this.prisma.currentSkuProjection.findMany({
      include: { skuProfile: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.currentSkuProjection.count();
    return { items: rows.map(toSkuSummaryFromProjection), page, pageSize, total };
  }

  async detail(_boundary: P0AuthContextDto, skuProfileId: string): Promise<SkuDetailDto | null> {
    const projection = await this.prisma.currentSkuProjection.findUnique({
      where: { skuProfileId },
      include: { skuProfile: true, latestSnapshot: true, latestDiagnosis: true },
    });
    if (!projection) return null;
    const summary = toSkuSummaryFromProjection(projection);
    const latestSnapshot = projection.latestSnapshot ? toSnapshotDto(projection.latestSnapshot as Record<string, unknown>) : null;
    const latestDiagnosis = projection.latestDiagnosis ? toDiagnosisDto(projection.latestDiagnosis as Record<string, unknown>) : null;
    return {
      ...summary,
      latestSnapshot,
      latestDiagnosis,
      evidence: [
        ...(latestSnapshot ? [evidence("snapshot", latestSnapshot.snapshotId, "采集事实", "当前 DTO 由 Prisma projection 装配")] : []),
        ...(latestDiagnosis ? [evidence("diagnosis", latestDiagnosis.diagnosisId, "健康诊断", "当前 DTO 由 Prisma projection 装配")] : []),
      ],
    };
  }
}

export class PrismaDashboardSkuReadModelRepository extends DashboardSkuReadModelRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async list(_boundary: P0AuthContextDto): Promise<DashboardSkuReadModelRecord[]> {
    const rows = await this.prisma.currentSkuProjection.findMany({
      include: { skuProfile: true, latestSnapshot: true, latestDiagnosis: true },
      orderBy: { updatedAt: "desc" },
    });
    const records: DashboardSkuReadModelRecord[] = [];
    for (const row of rows) {
      records.push(await this.toRecordFromProjection(row));
    }
    return records;
  }

  async detail(_boundary: P0AuthContextDto, skuProfileId: string): Promise<DashboardSkuReadModelRecord | null> {
    const row = await this.prisma.currentSkuProjection.findUnique({
      where: { skuProfileId },
      include: { skuProfile: true, latestSnapshot: true, latestDiagnosis: true },
    });
    return row ? this.toRecordFromProjection(row) : null;
  }

  private async toRecordFromProjection(row: Record<string, unknown>): Promise<DashboardSkuReadModelRecord> {
    const summary = toSkuSummaryFromProjection(row);
    const latestSnapshot = row.latestSnapshot ? toSnapshotDto(row.latestSnapshot as Record<string, unknown>) : null;
    const latestDiagnosis = row.latestDiagnosis ? toDiagnosisDto(row.latestDiagnosis as Record<string, unknown>) : null;
    const simulationRows = await this.prisma.activitySimulationResult.findMany({
      where: { skuProfileId: summary.skuProfileId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    const reviewRows = await this.prisma.reviewItem.findMany({
      where: { skuProfileId: summary.skuProfileId },
      orderBy: { createdAt: "desc" },
    });
    return {
      summary,
      latestSnapshot,
      latestDiagnosis,
      latestSimulationResult: simulationRows[0] ? toSimulationResultDto(simulationRows[0]) : null,
      relatedReviews: reviewRows.map(toReviewItemDto),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : latestDiagnosis?.diagnosedAt ?? latestSnapshot?.collectedAt ?? new Date(0).toISOString(),
    };
  }
}

export class PrismaActivityRepository extends ActivityRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async listActivities(_boundary: P0AuthContextDto, page = 1, pageSize = 20): Promise<PageDto<ActivityDto>> {
    const rows = await this.prisma.activity.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
    const total = await this.prisma.activity.count();
    return { items: rows.map(toActivityDto), page, pageSize, total };
  }

  async getActivity(_boundary: P0AuthContextDto, activityId: string): Promise<ActivityDto | null> {
    const row = await this.prisma.activity.findUnique({ where: { id: activityId } });
    return row ? toActivityDto(row) : null;
  }

  async createActivity(boundary: P0AuthContextDto, input: CreateActivityRequestDto): Promise<ActivityDto> {
    const activityId = nextUuid();
    const row = await this.prisma.activity.create({
      data: {
        id: activityId,
        name: input.name,
        platform: input.platform,
        scopeJson: { categoryScope: input.categoryScope ?? [], productScopeText: input.productScopeText ?? "全部当前 SKU" },
        status: "draft",
        startsAt: input.startAt ? new Date(input.startAt) : undefined,
        endsAt: input.endAt ? new Date(input.endAt) : undefined,
        createdBy: boundary.actorId,
      },
    });
    const audit = await this.recordWorkflowAudit(boundary, "activity_create", activityId, { input }, { activityId });
    await this.prisma.activity.update({ where: { id: activityId }, data: { latestWorkflowRunId: audit.entityId } });
    return { ...toActivityDto(row), latestRunId: audit.entityId };
  }

  async updateActivity(boundary: P0AuthContextDto, activityId: string, input: UpdateActivityRequestDto): Promise<ActivityDto> {
    const current = await this.getActivity(boundary, activityId);
    if (!current) throw new Error(`Activity not found: ${activityId}`);
    const row = await this.prisma.activity.update({
      where: { id: activityId },
      data: stripUndefined({
        name: input.name,
        platform: input.platform,
        status: input.status?.toLowerCase(),
        scopeJson: input.categoryScope || input.productScopeText ? { categoryScope: input.categoryScope ?? current.categoryScope ?? [], productScopeText: input.productScopeText ?? current.productScopeText } : undefined,
        startsAt: input.startAt ? new Date(input.startAt) : input.startAt === null ? null : undefined,
        endsAt: input.endAt ? new Date(input.endAt) : input.endAt === null ? null : undefined,
      }),
    });
    const audit = await this.recordWorkflowAudit(boundary, "activity_update", activityId, { input }, { activityId });
    await this.prisma.activity.update({ where: { id: activityId }, data: { latestWorkflowRunId: audit.entityId } });
    return { ...toActivityDto(row), latestRunId: audit.entityId };
  }

  async bindRuleSetToActivity(boundary: P0AuthContextDto, activityId: string, ruleSetId: string): Promise<ActivityDto> {
    const row = await this.prisma.activity.update({ where: { id: activityId }, data: { currentRuleSetId: ruleSetId } });
    await this.recordWorkflowAudit(boundary, "activity_rule_parse", activityId, { ruleSetId }, { activityId, ruleSetId });
    return toActivityDto(row);
  }

  async saveRuleSet(_boundary: P0AuthContextDto, ruleSet: ActivityRuleSetDto): Promise<ActivityRuleSetDto> {
    await this.prisma.activityRuleSet.create({
      data: {
        id: ruleSet.ruleSetId,
        name: ruleSet.name,
        platform: ruleSet.platform,
        sourceText: ruleSet.sourceText,
        rulesJson: ruleSet.rules,
        parseConfidence: ruleSet.confidence,
        parseStatus: ruleSet.parseStatus.toLowerCase(),
        parseMetadataJson: { errors: ruleSet.errors },
      },
    });
    return ruleSet;
  }

  async getRuleSet(_boundary: P0AuthContextDto, activityRuleSetId: string): Promise<ActivityRuleSetDto | null> {
    const row = await this.prisma.activityRuleSet.findUnique({ where: { id: activityRuleSetId } });
    if (!row) return null;
    return {
      ruleSetId: String(row.id),
      name: String(row.name),
      platform: typeof row.platform === "string" ? row.platform : undefined,
      sourceText: String(row.sourceText),
      rules: asArray(row.rulesJson) as CanonicalRuleDto[],
      parseStatus: String(row.parseStatus).toUpperCase() as ActivityRuleSetDto["parseStatus"],
      confidence: Number(row.parseConfidence ?? 0),
      errors: asArray((row.parseMetadataJson as { errors?: unknown[] } | undefined)?.errors).map(String),
    };
  }

  async saveSimulationRun(_boundary: P0AuthContextDto, run: ActivitySimulationRunDto): Promise<ActivitySimulationRunDto> {
    await this.prisma.activitySimulationRun.create({
      data: {
        id: run.simulationRunId,
        activityRuleSetId: run.activityRuleSetId,
        scopeJson: run.scope,
        status: run.status.toLowerCase(),
        summaryJson: { resultCount: run.results.length },
        startedAt: new Date(run.startedAt),
        completedAt: new Date(run.completedAt),
      },
    });
    for (const result of run.results) {
      await this.prisma.activitySimulationResult.create({
        data: {
          id: result.simulationResultId,
          simulationRunId: run.simulationRunId,
          activityRuleSetId: run.activityRuleSetId,
          skuProfileId: result.skuProfileId,
          eligibilityStatus: toPrismaEligibility(result.eligibility),
          failedRulesJson: result.failedRules,
          repairPlanJson: result.repairSuggestions,
          evidenceJson: result.evidence,
        },
      });
    }
    return run;
  }

  async bindSimulationRunToActivity(boundary: P0AuthContextDto, activityId: string, simulationRunId: string): Promise<ActivityDto> {
    const row = await this.prisma.activity.update({ where: { id: activityId }, data: { status: "running", summaryJson: { latestSimulationRunId: simulationRunId } } });
    await this.recordWorkflowAudit(boundary, "activity_simulation", activityId, { simulationRunId }, { activityId, simulationRunId });
    return { ...toActivityDto(row), latestRunId: simulationRunId };
  }

  async getSimulationRun(_boundary: P0AuthContextDto, simulationRunId: string): Promise<ActivitySimulationRunDto | null> {
    const row = await this.prisma.activitySimulationRun.findUnique({ where: { id: simulationRunId }, include: { results: true } });
    if (!row) return null;
    const results = asArray(row.results).map((result) => ({
      simulationResultId: String((result as Record<string, unknown>).id),
      skuProfileId: String((result as Record<string, unknown>).skuProfileId),
      ruleSetId: String((result as Record<string, unknown>).activityRuleSetId),
      eligibility: String((result as Record<string, unknown>).eligibilityStatus) as SimulationEligibility,
      failedRules: asArray((result as Record<string, unknown>).failedRulesJson) as CanonicalRuleDto[],
      evidence: asArray((result as Record<string, unknown>).evidenceJson) as SimulationResultDto["evidence"],
      repairSuggestions: asArray((result as Record<string, unknown>).repairPlanJson).map(String),
    }));
    return {
      simulationRunId: String(row.id),
      activityRuleSetId: String(row.activityRuleSetId),
      status: "SUCCEEDED",
      scope: asScope(row.scopeJson),
      results,
      startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : String(row.startedAt ?? row.createdAt ?? ""),
      completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : String(row.completedAt ?? row.updatedAt ?? ""),
    };
  }

  async recordWorkflowAudit(_boundary: P0AuthContextDto, workflowType: string, subjectId: string, input: Record<string, unknown>, output: Record<string, unknown>): Promise<TraceableRef> {
    const workflowRunId = nextUuid();
    const now = new Date();
    await this.prisma.workflowRun.create({
      data: { id: workflowRunId, workflowType, status: "SUCCEEDED", subjectType: "activity", subjectId, inputJson: input, outputJson: output, startedAt: now, completedAt: now },
    });
    return traceRef("workflow_run", workflowRunId, "Workflow audit");
  }
}

export class PrismaReviewRepository extends ReviewRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async list(_boundary: P0AuthContextDto, query: ReviewListQueryDto = {}): Promise<ReviewItemDto[]> {
    const rows = await this.prisma.reviewItem.findMany({ orderBy: { createdAt: "desc" } });
    const q = query.q?.trim().toLowerCase();
    return rows.map(toReviewItemDto).filter((item) => {
      const assembled = toReviewListItem(item);
      if (query.tab && assembled.status !== query.tab) return false;
      if (query.type && assembled.type !== query.type) return false;
      if (query.riskLevel && assembled.riskLevel !== query.riskLevel) return false;
      if (query.status && assembled.status !== query.status) return false;
      if (q && !`${assembled.title} ${assembled.summary} ${item.question}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  async create(_boundary: P0AuthContextDto, items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): Promise<ReviewItemDto[]> {
    const created: ReviewItemDto[] = [];
    for (const item of items) {
      const id = nextUuid();
      await this.prisma.reviewItem.create({
        data: {
          id,
          skuProfileId: item.skuProfileId,
          simulationResultId: item.sourceType === "simulation" ? item.sourceId : undefined,
          reviewType: item.sourceType,
          reasonCode: item.sourceType,
          status: "PENDING",
          question: item.question,
          agentRecommendation: item.recommendation,
          riskLevel: item.riskLevel,
          evidenceJson: item.evidence,
        },
      });
      created.push({ ...item, reviewItemId: id, status: "OPEN" });
    }
    return created;
  }

  async getById(_boundary: P0AuthContextDto, reviewItemId: string): Promise<ReviewItemDto | null> {
    const row = await this.prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
    return row ? toReviewItemDto(row) : null;
  }

  async update(_boundary: P0AuthContextDto, reviewItemId: string, patch: Partial<Pick<ReviewItemDto, "question" | "recommendation" | "riskLevel">>): Promise<ReviewItemDto> {
    const updated = await this.prisma.reviewItem.update({
      where: { id: reviewItemId },
      data: {
        question: patch.question,
        agentRecommendation: patch.recommendation,
        riskLevel: patch.riskLevel,
      },
    });
    await this.prisma.workflowRun.create({
      data: {
        id: nextUuid(),
        workflowType: "review_update",
        status: "SUCCEEDED",
        subjectType: "review_item",
        subjectId: reviewItemId,
        inputJson: patch,
        outputJson: { reviewItemId },
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return toReviewItemDto(updated);
  }

  async decide(_boundary: P0AuthContextDto, reviewItemId: string, request: ReviewDecisionRequestDto): Promise<ReviewItemDto> {
    const statusByDecision = { APPROVE: "APPROVED", REJECT: "REJECTED", REQUEST_CHANGES: "MODIFIED" } as const;
    const updated = await this.prisma.reviewItem.update({
      where: { id: reviewItemId },
      data: {
        status: statusByDecision[request.decision],
        decision: request.decision,
        decisionBy: request.decisionBy,
        decisionComment: request.decisionComment,
        decidedAt: new Date(),
      },
    });
    await this.prisma.workflowRun.create({
      data: {
        id: nextUuid(),
        workflowType: "review_decision",
        status: "SUCCEEDED",
        subjectType: "review_item",
        subjectId: reviewItemId,
        inputJson: { decision: request.decision, decisionBy: request.decisionBy, modifiedPayload: request.modifiedPayload },
        outputJson: { reviewItemId, status: statusByDecision[request.decision] },
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return toReviewItemDto(updated);
  }

  async approvalHistory(_boundary: P0AuthContextDto, reviewItemId: string): Promise<ReviewDetailDto["approvalHistory"]> {
    const rows = await this.prisma.workflowRun.findMany({ where: { subjectType: "review_item", subjectId: reviewItemId }, orderBy: { startedAt: "asc" } });
    return rows.map((row) => ({
      actor: String((row.inputJson as Record<string, unknown> | undefined)?.decisionBy ?? (row.inputJson as Record<string, unknown> | undefined)?.actorId ?? "system"),
      action: String(row.workflowType),
      comment: typeof (row.inputJson as Record<string, unknown> | undefined)?.decision === "string" ? String((row.inputJson as Record<string, unknown>).decision) : undefined,
      createdAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : String(row.startedAt ?? ""),
    }));
  }
}

export class PrismaReportRepository extends ReportRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async save(_boundary: P0AuthContextDto, report: ReportPreviewDto): Promise<ReportPreviewDto> {
    await this.prisma.workflowRun.create({
      data: {
        id: report.reportId,
        workflowType: "report_preview",
        status: "SUCCEEDED",
        subjectType: report.type,
        inputJson: { type: report.type },
        outputJson: report,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return report;
  }

  async saveDetail(_boundary: P0AuthContextDto, detail: ReportDetailDto): Promise<ReportDetailDto> {
    if (!this.prisma.report || !this.prisma.reportVersion) return detail;
    const versionId = nextUuid();
    await this.prisma.report.create({
      data: {
        id: detail.reportId,
        title: detail.title,
        reportType: "ACTIVITY",
        status: detail.status,
        latestVersionId: versionId,
        exportStatus: "NONE",
        subscriptionJson: {},
        summaryJson: detail.summary,
        createdBy: "api",
      },
    });
    await this.prisma.reportVersion.create({
      data: {
        id: versionId,
        reportId: detail.reportId,
        version: 1,
        status: detail.status,
        sectionsJson: detail,
        evidenceRefsJson: detail.evidenceSummary,
        exportArtifactsJson: {},
        createdBy: "api",
      },
    });
    return detail;
  }

  async list(_boundary: P0AuthContextDto): Promise<ReportDetailDto[]> {
    if (!this.prisma.report) return [];
    const rows = await this.prisma.report.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toReportDetailFromRow);
  }

  async getById(_boundary: P0AuthContextDto, reportId: string): Promise<ReportDetailDto | null> {
    if (!this.prisma.report) return null;
    const row = await this.prisma.report.findUnique({ where: { id: reportId } });
    return row ? toReportDetailFromRow(row) : null;
  }

  async listVersions(_boundary: P0AuthContextDto, reportId: string): Promise<ReportVersionDto[]> {
    if (!this.prisma.reportVersion) return [];
    const rows = await this.prisma.reportVersion.findMany({ where: { reportId }, orderBy: { version: "desc" } });
    return rows.map(toReportVersionFromRow);
  }

  async getVersion(_boundary: P0AuthContextDto, reportId: string, versionId: string): Promise<ReportVersionDto | null> {
    if (!this.prisma.reportVersion) return null;
    const row = await this.prisma.reportVersion.findUnique({ where: { id: versionId } });
    if (!row || String(row.reportId) !== reportId) return null;
    return toReportVersionFromRow(row);
  }

  async createExport(_boundary: P0AuthContextDto, reportId: string, request: ReportExportRequestDto): Promise<ReportExportJobDto> {
    if (this.prisma.report) {
      await this.prisma.report.update({ where: { id: reportId }, data: { exportStatus: "PENDING" } });
    }
    return { exportJobId: request.idempotencyKey ?? nextUuid(), reportId, status: "PENDING", format: request.format, requestedAt: new Date().toISOString() };
  }

  async saveSubscription(_boundary: P0AuthContextDto, reportId: string, request: ReportSubscriptionRequestDto): Promise<ReportSubscriptionDto> {
    const subscription = { ...request, reportId, updatedAt: new Date().toISOString() };
    if (this.prisma.report) {
      await this.prisma.report.update({ where: { id: reportId }, data: { subscriptionJson: subscription } });
    }
    return subscription;
  }

  async getSimulationResult(_boundary: P0AuthContextDto, id: string): Promise<SimulationResultDto | null> {
    const row = await this.prisma.activitySimulationResult.findUnique({ where: { id } });
    if (!row) return null;
    return {
      simulationResultId: String(row.id),
      skuProfileId: String(row.skuProfileId),
      ruleSetId: String(row.activityRuleSetId),
      eligibility: String(row.eligibilityStatus) as SimulationEligibility,
      failedRules: asArray(row.failedRulesJson) as CanonicalRuleDto[],
      evidence: asArray(row.evidenceJson) as SimulationResultDto["evidence"],
      repairSuggestions: asArray(row.repairPlanJson).map(String),
    };
  }
}

function toPrismaHealthStatus(status: HealthDiagnosisDto["healthStatus"]): string {
  if (status === "READY") return "READY";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "UNKNOWN") return "RISKY";
  return "REPAIRABLE";
}

export class FinalIngestService {
  constructor(
    private readonly tx: TransactionManager,
    private readonly repository: IngestRepository,
    private readonly skuQueryRepository: SkuQueryRepository,
    private readonly normalizationService = new NormalizationService(),
    private readonly healthAssessmentService = new HealthAssessmentService(),
  ) {}

  async ingest(payload: IngestPayloadDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<IngestResponseDto> {
    assertValidIngestPayload(payload);
    return this.tx.transaction(async (tx) => {
      const summaries: SkuSummaryDto[] = [];
      const snapshots: NormalizedSkuSnapshotDto[] = [];
      const diagnoses: HealthDiagnosisDto[] = [];
      for (const row of payload.rows) {
        const key = canonicalSkuKey(row);
        const existingSkuProfileId = await this.repository.findSkuProfileIdByCanonicalKey(tx, key);
        const skuProfileId = existingSkuProfileId ?? (tx.prisma ? nextUuid() : nextId("sku"));
        const snapshot = this.normalizationService.normalize(row, skuProfileId, payload.collectedAt);
        const diagnosis = this.healthAssessmentService.assess(snapshot);
        summaries.push(await this.repository.upsertIngestAggregate(tx, { boundary, row, collectedAt: payload.collectedAt, snapshot, diagnosis }));
        snapshots.push(snapshot);
        diagnoses.push(diagnosis);
      }
      const audit = await this.repository.recordWorkflowAudit(tx, boundary, {
        workflowType: "ingest",
        subjectType: "sku_batch",
        input: { connectorId: payload.connectorId, rowCount: payload.rows.length, collectedAt: payload.collectedAt, actorId: boundary.actorId, tenantId: boundary.tenantId, sessionId: boundary.sessionId, surface: boundary.surface },
        output: { skuProfileIds: summaries.map((item) => item.skuProfileId), tenantId: boundary.tenantId, sessionId: boundary.sessionId },
      });
      return { summaries, snapshots, diagnoses, workflowRunId: audit.workflowRunId };
    });
  }

  async getHealthSummary(boundary: P0AuthContextDto = explicitDevBoundary): Promise<HealthSummaryDto> {
    return this.skuQueryRepository.healthSummary(boundary);
  }

  async listSkus(page?: number, pageSize?: number, boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<SkuSummaryDto>> {
    return this.skuQueryRepository.list(boundary, page, pageSize);
  }

  async getSkuDetail(skuProfileId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<SkuDetailDto | null> {
    return this.skuQueryRepository.detail(boundary, skuProfileId);
  }
}

export class FinalActivityService {
  constructor(private readonly repository: ActivityRepository, private readonly skuQueryRepository: SkuQueryRepository) {}

  list(page?: number, pageSize?: number, boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<ActivityDto>> {
    return Promise.resolve(this.repository.listActivities(boundary, page, pageSize));
  }

  async detail(activityId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityExecutionPlanDto | null> {
    const activity = await this.repository.getActivity(boundary, activityId);
    if (!activity) return null;
    return this.buildExecutionPlan(activity, boundary);
  }

  create(input: CreateActivityRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityDto> {
    if (!input.name?.trim()) throw new Error("Activity name is required");
    return Promise.resolve(this.repository.createActivity(boundary, input));
  }

  update(activityId: string, input: UpdateActivityRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityDto> {
    return Promise.resolve(this.repository.updateActivity(boundary, activityId, input));
  }

  async parseForActivity(activityId: string, input: ParseActivityRuleSetRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityExecutionPlanDto> {
    const activity = await this.repository.getActivity(boundary, activityId);
    if (!activity) throw new Error(`Activity not found: ${activityId}`);
    const ruleSet = await this.parse({ name: input.name ?? `${activity.name} 规则`, platform: activity.platform, sourceText: input.sourceText, rules: input.rules }, boundary);
    const updated = await this.repository.bindRuleSetToActivity(boundary, activityId, ruleSet.ruleSetId);
    return this.buildExecutionPlan(updated, boundary);
  }

  async executionPlan(activityId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityExecutionPlanDto | null> {
    const activity = await this.repository.getActivity(boundary, activityId);
    if (!activity) return null;
    return this.buildExecutionPlan(activity, boundary);
  }

  async startRun(activityId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityExecutionPlanDto> {
    const activity = await this.repository.getActivity(boundary, activityId);
    if (!activity) throw new Error(`Activity not found: ${activityId}`);
    const audit = await this.repository.recordWorkflowAudit(boundary, "activity_execution_path", activityId, { activityId }, { status: "planned" });
    return { ...(await this.buildExecutionPlan({ ...activity, latestRunId: audit.entityId, status: "RUNNING" }, boundary)), runId: audit.entityId };
  }

  async simulateForActivity(activityId: string, request: Omit<SimulationRequestDto, "ruleSetId">, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivitySimulationRunDetailDto> {
    const activity = await this.repository.getActivity(boundary, activityId);
    if (!activity?.currentRuleSetId) throw new Error("Activity rule set is required before simulation");
    const run = await this.simulate(activity.currentRuleSetId, request, boundary);
    await this.repository.bindSimulationRunToActivity(boundary, activityId, run.simulationRunId);
    const plan = await this.buildExecutionPlan({ ...activity, latestRunId: run.simulationRunId, status: "RUNNING" }, boundary);
    return this.toSimulationDetail(activityId, run, plan);
  }

  async simulationDetail(activityId: string, simulationRunId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivitySimulationRunDetailDto | null> {
    const activity = await this.repository.getActivity(boundary, activityId);
    const run = await this.repository.getSimulationRun(boundary, simulationRunId);
    if (!activity || !run) return null;
    return this.toSimulationDetail(activityId, run, await this.buildExecutionPlan(activity, boundary));
  }

  async parse(input: { name: string; platform?: string; sourceText: string; rules?: CanonicalRuleDto[] }, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityRuleSetDto> {
    const rules = input.rules ?? deterministicRules(input.sourceText);
    const ruleSet: ActivityRuleSetDto = {
      ruleSetId: nextId("rules"),
      name: input.name,
      platform: input.platform,
      sourceText: input.sourceText,
      rules,
      parseStatus: rules.some((rule) => rule.type === "manual_review") ? "NEEDS_REVIEW" : "PARSED",
      confidence: rules.length > 0 ? 0.86 : 0.2,
      errors: [],
    };
    try {
      assertValidRuleSet(ruleSet);
    } catch (error) {
      ruleSet.parseStatus = "FAILED";
      ruleSet.confidence = 0;
      ruleSet.errors.push(error instanceof Error ? error.message : "Rule DSL validation failed");
    }
    return this.repository.saveRuleSet(boundary, ruleSet);
  }

  async simulate(activityRuleSetId: string, request: Omit<SimulationRequestDto, "ruleSetId">, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivitySimulationRunDto> {
    const ruleSet = await this.repository.getRuleSet(boundary, activityRuleSetId);
    if (!ruleSet || ruleSet.parseStatus === "FAILED") throw new Error("Valid rule set is required before simulation");
    const startedAt = new Date().toISOString();
    const results = await Promise.all(request.skuProfileIds.map(async (skuProfileId) => {
      const detail = await this.skuQueryRepository.detail(boundary, skuProfileId);
      if (!detail?.latestSnapshot) throw new Error(`SKU detail not found: ${skuProfileId}`);
      const original = evaluate(detail.latestSnapshot, ruleSet.rules);
      const changedSnapshot = request.whatIf ? { ...detail.latestSnapshot, ...request.whatIf } : detail.latestSnapshot;
      const changed = evaluate(changedSnapshot, ruleSet.rules);
      return {
        simulationResultId: nextId("simulation"),
        skuProfileId,
        ruleSetId: activityRuleSetId,
        eligibility: changed.eligibility,
        failedRules: changed.failedRules,
        evidence: [evidence("rule", activityRuleSetId, "活动规则集", "准入模拟基于持久化规则集执行"), evidence("snapshot", detail.latestSnapshot.snapshotId, "SKU 快照", "模拟读取当前 SKU 快照，不修改长期健康状态")],
        repairSuggestions: changed.failedRules.map((rule) => repairSuggestion(rule)),
        originalEligibility: request.whatIf ? original.eligibility : undefined,
      } satisfies SimulationResultDto;
    }));
    return this.repository.saveSimulationRun(boundary, {
      simulationRunId: nextId("simulation_run"),
      activityRuleSetId,
      status: "SUCCEEDED",
      scope: { skuProfileIds: request.skuProfileIds, whatIf: request.whatIf },
      results,
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  private async buildExecutionPlan(activity: ActivityDto, boundary: P0AuthContextDto): Promise<ActivityExecutionPlanDto> {
    const ruleSet = activity.currentRuleSetId ? await this.repository.getRuleSet(boundary, activity.currentRuleSetId) : null;
    const rules = ruleSet?.rules ?? [];
    const requiredFields = rules.flatMap((rule) => extractRequiredFields(rule)).filter((field, index, items) => items.findIndex((item) => item.field === field.field) === index);
    const pendingConfirmations = [
      ...rules.filter((rule) => rule.type === "manual_review").map((rule) => ({ type: "RULE_AMBIGUITY" as const, title: rule.message, actionLabel: "进入 Review 确认" })),
      ...requiredFields.filter((item) => item.status !== "READY").map((item) => ({ type: item.status === "AMBIGUOUS_MAPPING" ? "FIELD_MAPPING" as const : "DATA_SOURCE" as const, title: `${item.label} 需要确认`, actionLabel: "补齐数据或确认映射" })),
    ];
    const ruleTrace = ruleSet ? traceRef("rule_set", ruleSet.ruleSetId, ruleSet.name) : undefined;
    return {
      activityId: activity.activityId,
      runId: activity.latestRunId,
      ruleSet: {
        ruleSetId: ruleSet?.ruleSetId ?? "",
        version: "v1",
        parseStatus: ruleSet?.parseStatus ?? "NEEDS_REVIEW",
        confidence: ruleSet?.confidence ?? 0,
        rules,
      },
      steps: buildPlanSteps(Boolean(ruleSet), requiredFields, activity.latestRunId, ruleTrace),
      requiredFields,
      dataSources: [{ connectorId: "connector_current_projection", name: "Current SKU Projection", status: "AVAILABLE", lastSyncedAt: activity.updatedAt }],
      pendingConfirmations,
      relatedRuns: activity.latestRunId ? [traceRef(activity.latestRunId.startsWith("workflow") ? "workflow_run" : "simulation_run", activity.latestRunId, "最近活动运行")] : [],
    };
  }

  private toSimulationDetail(activityId: string, run: ActivitySimulationRunDto, plan: ActivityExecutionPlanDto): ActivitySimulationRunDetailDto {
    return {
      activityId,
      simulationRunId: run.simulationRunId,
      activityRuleSetId: run.activityRuleSetId,
      status: run.status,
      scope: run.scope,
      results: run.results,
      plan: plan.steps,
      evidenceRefs: run.results.flatMap((result) => result.evidence.map((item) => evidenceRefFromLink(item))),
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }
}

export class FinalReviewService {
  constructor(private readonly repository: ReviewRepository) {}

  async list(query: ReviewListQueryDto = {}, boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<ReviewListItemDto>> {
    const rawItems = await this.repository.list(boundary, query);
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const items = rawItems.map(toReviewListItem);
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
  }

  async getDetail(reviewItemId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReviewDetailDto | null> {
    const item = await this.repository.getById(boundary, reviewItemId);
    if (!item) return null;
    return toReviewDetail(item, await this.repository.approvalHistory(boundary, reviewItemId));
  }

  async create(items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReviewItemDto[]> {
    return this.repository.create(boundary, items);
  }

  async update(reviewItemId: string, patch: Partial<Pick<ReviewItemDto, "question" | "recommendation" | "riskLevel">>, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReviewDetailDto> {
    const item = await this.repository.update(boundary, reviewItemId, patch);
    return toReviewDetail(item, await this.repository.approvalHistory(boundary, reviewItemId));
  }

  async decide(reviewItemId: string, request: ReviewDecisionRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReviewDetailDto> {
    const item = await this.repository.decide(boundary, reviewItemId, request);
    return toReviewDetail(item, await this.repository.approvalHistory(boundary, reviewItemId));
  }
}

export class FinalReportService {
  constructor(private readonly repository: ReportRepository, private readonly skuQueryRepository: SkuQueryRepository) {}

  async generate(input: ReportRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReportPreviewDto> {
    const details = (await Promise.all(input.skuProfileIds.map((id) => this.skuQueryRepository.detail(boundary, id)))).filter((item): item is SkuDetailDto => item !== null);
    const simulations = (await Promise.all((input.simulationResultIds ?? []).map((id) => this.repository.getSimulationResult(boundary, id)))).filter((item): item is SimulationResultDto => item !== null);
    const simulationEvidence = simulations.map((result) => evidence("simulation", result.simulationResultId, "活动模拟", `准入状态：${result.eligibility}`));
    const unresolvedHealthRisks = details.filter((item) => item.healthStatus !== "READY").flatMap((item) => item.topIssues.map((issue) => `${item.productName}：${issue}`));
    const unresolvedSimulationRisks = simulations.filter((item) => item.eligibility === "MANUAL_REVIEW" || item.eligibility === "BLOCKED").map((item) => `${item.simulationResultId}：${item.eligibility}，失败规则 ${item.failedRules.length} 条`);
    const report: ReportPreviewDto = {
      reportId: nextId("report"),
      type: input.type,
      status: "PREVIEW",
      title: input.type === "HEALTH" ? "SKU 健康报告预览" : "活动准入报告预览",
      sections: [
        { id: "summary", title: "摘要", summary: `覆盖 ${details.length} 个 SKU，阻塞 ${details.filter((item) => item.healthStatus === "BLOCKED").length} 个。`, evidence: details.flatMap((item) => item.evidence) },
        { id: "next_actions", title: "下一步动作", summary: details.flatMap((item) => item.nextActions).join("；") || "暂无下一步动作", evidence: simulationEvidence },
        { id: "unresolved_risks", title: "未解决风险", summary: [...unresolvedHealthRisks, ...unresolvedSimulationRisks].join("；") || "当前预览没有未解决阻塞或人工确认风险", evidence: [...details.flatMap((item) => item.evidence), ...simulationEvidence] },
      ],
      evidenceSummary: [...details.flatMap((item) => item.evidence), ...simulationEvidence],
    };
    await this.repository.save(boundary, report);
    await this.repository.saveDetail(boundary, toReportDetail(report, details, simulations, []));
    return report;
  }

  async list(boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<ReportListItemDto>> {
    const items = (await this.repository.list(boundary)).map((detail) => ({
      reportId: detail.reportId,
      title: detail.title,
      version: detail.version,
      status: detail.status,
      generatedAt: detail.generatedAt,
      sourceRun: detail.sourceRun,
      exportStatus: "NONE" as const,
    }));
    return { items, page: 1, pageSize: items.length || 20, total: items.length };
  }

  async getDetail(reportId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReportDetailDto | null> {
    return this.repository.getById(boundary, reportId);
  }

  async listVersions(reportId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<ReportVersionDto>> {
    const items = await this.repository.listVersions(boundary, reportId);
    return { items, page: 1, pageSize: items.length || 20, total: items.length };
  }

  async getVersion(reportId: string, versionId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReportVersionDto | null> {
    return this.repository.getVersion(boundary, reportId, versionId);
  }

  async export(reportId: string, request: ReportExportRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReportExportJobDto> {
    return this.repository.createExport(boundary, reportId, request);
  }

  async saveSubscription(reportId: string, request: ReportSubscriptionRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReportSubscriptionDto> {
    return this.repository.saveSubscription(boundary, reportId, request);
  }
}

export class SkuReadinessQueryService {
  constructor(private readonly repository: DashboardSkuReadModelRepository) {}

  async list(query: DashboardSkuListQuery, boundary: P0AuthContextDto): Promise<PageDto<DashboardSkuListItemDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filtered = (await this.repository.list(boundary)).filter((record) => matchesDashboardSkuQuery(record, query));
    const sorted = sortDashboardSkuRecords(filtered, query);
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize).map(toDashboardSkuListItem),
      page,
      pageSize,
      total: sorted.length,
    };
  }

  async detail(skuProfileId: string, boundary: P0AuthContextDto): Promise<DashboardSkuReadinessDetailDto | null> {
    const record = await this.repository.detail(boundary, skuProfileId);
    return record ? toDashboardSkuDetail(record) : null;
  }
}

function toSummary(profile: SkuProfileRecord, diagnosis: HealthDiagnosisDto): SkuSummaryDto {
  return {
    skuProfileId: profile.skuProfileId,
    canonicalSkuKey: profile.canonicalSkuKey,
    productName: profile.productName,
    platform: profile.platform,
    storeId: profile.storeId,
    healthStatus: diagnosis.healthStatus,
    healthScore: diagnosis.healthScore,
    dataQualityScore: diagnosis.dataQualityScore,
    topIssues: diagnosis.issues.slice(0, 3),
    nextActions: diagnosis.nextActions.slice(0, 3),
  };
}

function matchesDashboardSkuQuery(record: DashboardSkuReadModelRecord, query: DashboardSkuListQuery): boolean {
  const snapshot = record.latestSnapshot;
  const q = query.q?.trim().toLowerCase();
  if (q && ![record.summary.productName, record.summary.canonicalSkuKey, snapshot?.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(q))) return false;
  if (query.platform && record.summary.platform !== query.platform) return false;
  if (query.category && snapshot?.category !== query.category) return false;
  if (query.healthStatus && toDashboardHealthStatus(record.summary.healthStatus) !== query.healthStatus) return false;
  if (query.eligibilityStatus && record.latestSimulationResult?.eligibility !== query.eligibilityStatus) return false;
  if (query.certificateStatus && snapshot?.certificateStatus !== query.certificateStatus) return false;
  return true;
}

function sortDashboardSkuRecords(records: DashboardSkuReadModelRecord[], query: DashboardSkuListQuery): DashboardSkuReadModelRecord[] {
  const direction = query.sortOrder === "asc" ? 1 : -1;
  const sortBy = query.sortBy ?? "updatedAt";
  return [...records].sort((left, right) => {
    const leftValue = dashboardSortValue(left, sortBy);
    const rightValue = dashboardSortValue(right, sortBy);
    return leftValue < rightValue ? -1 * direction : leftValue > rightValue ? direction : 0;
  });
}

function dashboardSortValue(record: DashboardSkuReadModelRecord, sortBy: NonNullable<DashboardSkuListQuery["sortBy"]>): number {
  if (sortBy === "sales30d") return record.latestSnapshot?.sales30d ?? 0;
  if (sortBy === "positiveRate") return record.latestSnapshot?.positiveRate ?? 0;
  if (sortBy === "stock") return record.latestSnapshot?.stock ?? 0;
  return Date.parse(record.updatedAt) || 0;
}

function toDashboardSkuListItem(record: DashboardSkuReadModelRecord): DashboardSkuListItemDto {
  const healthStatus = toDashboardHealthStatus(record.summary.healthStatus);
  const eligibilityStatus = record.latestSimulationResult?.eligibility;
  return {
    skuProfileId: record.summary.skuProfileId,
    displaySku: record.summary.canonicalSkuKey,
    productName: record.summary.productName,
    category: record.latestSnapshot?.category,
    sales30d: record.latestSnapshot?.sales30d,
    positiveRate: record.latestSnapshot?.positiveRate,
    stock: record.latestSnapshot?.stock,
    healthStatus,
    eligibilityStatus,
    eligibilityLabel: eligibilityLabel(eligibilityStatus),
    nextAction: nextDashboardSkuAction(healthStatus, eligibilityStatus),
    evidenceCount: evidenceRefsForRecord(record).length,
    updatedAt: record.updatedAt,
  };
}

function toDashboardSkuDetail(record: DashboardSkuReadModelRecord): DashboardSkuReadinessDetailDto {
  const evidenceRefs = evidenceRefsForRecord(record);
  const healthStatus = toDashboardHealthStatus(record.summary.healthStatus);
  const eligibilityStatus = record.latestSimulationResult?.eligibility;
  return {
    skuProfileId: record.summary.skuProfileId,
    displaySku: record.summary.canonicalSkuKey,
    productName: record.summary.productName,
    category: record.latestSnapshot?.category,
    platform: record.summary.platform,
    storeId: record.summary.storeId,
    statusSummary: {
      healthStatus,
      eligibilityStatus,
      conclusion: statusConclusion(healthStatus, eligibilityStatus),
      nextStep: nextDashboardSkuAction(healthStatus, eligibilityStatus).label,
    },
    readinessChecklist: readinessChecklist(record),
    evidenceOverview: {
      documentCount: evidenceRefs.filter((item) => item.sourceType === "sku_snapshot").length,
      dataCheckPassedCount: readinessChecklist(record).filter((item) => item.status === "PASSED").length,
      imageEvidenceCount: evidenceRefs.filter((item) => item.field?.toLowerCase().includes("image")).length,
      manualConfirmationCount: record.relatedReviews.length,
    },
    latestSnapshot: record.latestSnapshot ? { ...record.latestSnapshot } : null,
    latestDiagnosis: record.latestDiagnosis
      ? {
          diagnosisId: record.latestDiagnosis.diagnosisId,
          healthStatus: toDashboardHealthStatus(record.latestDiagnosis.healthStatus),
          healthScore: record.latestDiagnosis.healthScore,
          dataQualityScore: record.latestDiagnosis.dataQualityScore,
          issues: record.latestDiagnosis.issues,
          nextActions: record.latestDiagnosis.nextActions,
          diagnosedAt: record.latestDiagnosis.diagnosedAt,
          evidenceRefs: evidenceRefs.filter((item) => item.sourceType === "health_diagnosis"),
        }
      : null,
    relatedRules: record.latestSimulationResult ? [traceableRef("rule_set", record.latestSimulationResult.ruleSetId, "活动规则集")] : [],
    relatedReviews: record.relatedReviews.map((item) => traceableRef("review_item", item.reviewItemId, item.question)),
  };
}

function readinessChecklist(record: DashboardSkuReadModelRecord): DashboardSkuReadinessDetailDto["readinessChecklist"] {
  const snapshotRefs = evidenceRefsForRecord(record).filter((item) => item.sourceType === "sku_snapshot");
  const diagnosisRefs = evidenceRefsForRecord(record).filter((item) => item.sourceType === "health_diagnosis");
  const simulationRefs = evidenceRefsForRecord(record).filter((item) => item.sourceType === "simulation_result" || item.sourceType === "rule_set");
  return [
    { id: "data_quality", label: "数据质量", status: record.summary.dataQualityScore >= 80 ? "PASSED" : "MISSING_DATA", evidenceRefs: diagnosisRefs.length ? diagnosisRefs : snapshotRefs },
    { id: "health_status", label: "长期健康状态", status: toDashboardHealthStatus(record.summary.healthStatus) === "BLOCKED" ? "FAILED" : "PASSED", evidenceRefs: diagnosisRefs },
    { id: "activity_eligibility", label: "活动准入状态", status: checklistEligibilityStatus(record.latestSimulationResult?.eligibility), evidenceRefs: simulationRefs.length ? simulationRefs : diagnosisRefs },
  ];
}

function checklistEligibilityStatus(status: DashboardSkuEligibilityStatus | undefined): "PASSED" | "FAILED" | "MISSING_DATA" | "MANUAL_REVIEW" {
  if (!status) return "MISSING_DATA";
  if (status === "DIRECT_READY" || status === "REPAIRABLE_READY") return "PASSED";
  if (status === "MANUAL_REVIEW") return "MANUAL_REVIEW";
  return "FAILED";
}

function evidenceRefsForRecord(record: DashboardSkuReadModelRecord): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  if (record.latestSnapshot) {
    refs.push({
      ...traceableRef("sku_snapshot", record.latestSnapshot.snapshotId, "最新采集快照"),
      sourceType: "sku_snapshot",
      sourceId: record.latestSnapshot.snapshotId,
      evidenceText: "SKU 详情由最新采集快照驱动",
      collectedAt: record.latestSnapshot.collectedAt,
    });
  }
  if (record.latestDiagnosis) {
    refs.push({
      ...traceableRef("health_diagnosis", record.latestDiagnosis.diagnosisId, "最新健康诊断"),
      sourceType: "health_diagnosis",
      sourceId: record.latestDiagnosis.diagnosisId,
      evidenceText: record.latestDiagnosis.issues.join("；") || "健康诊断无阻塞问题",
      collectedAt: record.latestDiagnosis.diagnosedAt,
    });
  }
  if (record.latestSimulationResult) {
    refs.push({
      ...traceableRef("simulation_result", record.latestSimulationResult.simulationResultId, "最新活动准入模拟"),
      sourceType: "simulation_result",
      sourceId: record.latestSimulationResult.simulationResultId,
      evidenceText: `活动准入状态：${record.latestSimulationResult.eligibility}`,
    });
    refs.push({
      ...traceableRef("rule_set", record.latestSimulationResult.ruleSetId, "活动规则集"),
      sourceType: "rule_set",
      sourceId: record.latestSimulationResult.ruleSetId,
      evidenceText: "活动准入结论由规则集模拟生成",
    });
  }
  return refs;
}

function traceableRef(entityType: TraceableRef["entityType"], entityId: string, label: string): TraceableRef {
  return { entityType, entityId, label, drawerTarget: `${entityType}:${entityId}` };
}

function toDashboardHealthStatus(status: HealthDiagnosisDto["healthStatus"]): DashboardSkuHealthStatus {
  if (status === "READY") return "READY";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "UNKNOWN") return "RISKY";
  return "REPAIRABLE";
}

function eligibilityLabel(status: DashboardSkuEligibilityStatus | undefined): string {
  if (status === "DIRECT_READY") return "可直接加入";
  if (status === "REPAIRABLE_READY") return "修复后可加入";
  if (status === "MANUAL_REVIEW") return "需人工复核";
  if (status === "BLOCKED") return "不可加入";
  return "未模拟";
}

function nextDashboardSkuAction(healthStatus: DashboardSkuHealthStatus, eligibilityStatus: DashboardSkuEligibilityStatus | undefined): DashboardSkuListItemDto["nextAction"] {
  if (eligibilityStatus === "DIRECT_READY") return { type: "JOIN_ACTIVITY", label: "加入候选清单" };
  if (eligibilityStatus === "MANUAL_REVIEW") return { type: "MANUAL_REVIEW", label: "提交人工复核" };
  if (eligibilityStatus === "BLOCKED" || healthStatus === "BLOCKED") return { type: "VIEW_BLOCKER", label: "查看阻塞原因", disabled: true };
  if (eligibilityStatus === "REPAIRABLE_READY" || healthStatus === "REPAIRABLE" || healthStatus === "RISKY") return { type: "REPAIR_ISSUE", label: "查看修复项" };
  return { type: "VIEW_DETAIL", label: "查看详情" };
}

function statusConclusion(healthStatus: DashboardSkuHealthStatus, eligibilityStatus: DashboardSkuEligibilityStatus | undefined): string {
  return `${healthStatus} / ${eligibilityLabel(eligibilityStatus)}`;
}

function deterministicRules(sourceText: string): CanonicalRuleDto[] {
  const rules: CanonicalRuleDto[] = [];
  const stockThreshold = matchFirstNumber(sourceText, /库存[^0-9一二三四五六七八九十百千万]*([0-9]+)/i);
  const positiveRateThreshold = matchPercent(sourceText, /好评[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
  if (/库存|stock/i.test(sourceText)) rules.push({ id: "stock_min", type: "threshold", field: "stock", operator: "gte", value: stockThreshold ?? 20, message: `活动库存不少于 ${stockThreshold ?? 20}`, severity: "blocking" });
  if (/好评|positive/i.test(sourceText)) rules.push({ id: "positive_rate", type: "threshold", field: "positiveRate", operator: "gte", value: positiveRateThreshold ?? 0.92, message: `好评率不少于 ${Math.round((positiveRateThreshold ?? 0.92) * 100)}%`, severity: "blocking" });
  if (/证书|certificate/i.test(sourceText)) rules.push({ id: "certificate_valid", type: "threshold", field: "certificateStatus", operator: "eq", value: "valid", message: "证书状态必须有效", severity: "blocking" });
  if (/商机|business_chance_center|clue/i.test(sourceText)) rules.push({ id: "business_chance_manual_review", type: "manual_review", message: "business_chance_center 商机线索需要人工确认后才能转成活动规则", severity: "warning" });
  if (/人工|manual/i.test(sourceText)) rules.push({ id: "manual_check", type: "manual_review", message: "需要人工确认活动规则歧义", severity: "warning" });
  return rules.length ? rules : [{ id: "manual_parse", type: "manual_review", message: "规则文本未命中确定性解析，需要人工确认", severity: "warning" }];
}

function matchFirstNumber(sourceText: string, pattern: RegExp): number | undefined {
  const match = sourceText.match(pattern);
  if (!match?.[1]) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function matchPercent(sourceText: string, pattern: RegExp): number | undefined {
  const value = matchFirstNumber(sourceText, pattern);
  if (value === undefined) return undefined;
  return value > 1 ? value / 100 : value;
}

function evaluate(snapshot: NormalizedSkuSnapshotDto, rules: CanonicalRuleDto[]): { eligibility: SimulationEligibility; failedRules: CanonicalRuleDto[] } {
  const failedRules = rules.filter((rule) => {
    if (rule.type === "manual_review") return true;
    const actual = rule.field ? snapshot[rule.field as keyof NormalizedSkuSnapshotDto] : undefined;
    if (rule.operator === "gte") return Number(actual) < Number(rule.value);
    if (rule.operator === "lte") return Number(actual) > Number(rule.value);
    if (rule.operator === "eq") return actual !== rule.value;
    if (rule.operator === "neq") return actual === rule.value;
    return false;
  });
  if (!failedRules.length) return { eligibility: "DIRECT_READY", failedRules };
  if (failedRules.some((rule) => rule.type === "manual_review")) return { eligibility: "MANUAL_REVIEW", failedRules };
  if (failedRules.length <= 2) return { eligibility: "REPAIRABLE_READY", failedRules };
  return { eligibility: "BLOCKED", failedRules };
}

function repairSuggestion(rule: CanonicalRuleDto): string {
  if (rule.field === "stock") return "补货到活动门槛以上后重跑模拟";
  if (rule.field === "certificateStatus") return "补齐有效证书后提交人工复核";
  return `修复规则失败项：${rule.message}`;
}

function toReviewListItem(item: ReviewItemDto): ReviewListItemDto {
  const status = toWorkbenchReviewStatus(item.status);
  const type = item.sourceType === "simulation" ? "ACTIVITY_CONFLICT" : item.sourceType === "health" ? "CERTIFICATE" : "AGENT_REVIEW_GATE";
  const riskLevel = item.riskLevel === "L2" ? "HIGH" : item.riskLevel === "L1" ? "MEDIUM" : "LOW";
  return {
    reviewItemId: item.reviewItemId,
    priority: riskLevel === "HIGH" ? "P1" : "P2",
    type,
    title: item.question || "待人工确认的 Review 项",
    summary: item.recommendation || "需要运营在 Review 工作台确认后继续。",
    status,
    riskLevel,
    assignee: { name: "运营审批组", team: "Ops Review" },
    dueAt: item.decidedAt,
    evidenceSummary: item.evidence.map((ref) => ref.label).filter(Boolean).join(" / ") || "已关联可追溯证据",
  };
}

function toReviewDetail(item: ReviewItemDto, approvalHistory: ReviewDetailDto["approvalHistory"]): ReviewDetailDto {
  const listItem = toReviewListItem(item);
  const evidenceRefs = item.evidence.map(toEvidenceRef);
  const sourceRef = toTraceableRef(item.sourceType === "simulation" ? "simulation_result" : item.sourceType === "health" ? "health_diagnosis" : "agent_run", item.sourceId, "Review 来源对象");
  return {
    ...listItem,
    recommendation: {
      actionType: item.sourceType === "simulation" ? "CONFIRM_RULE" : item.sourceType === "health" ? "UPLOAD_CERTIFICATE" : "CONFIRM_MAPPING",
      content: item.recommendation || "先确认证据链和影响范围，再推进后续 workflow。",
      expectedEffect: "只推进审批链路或生成建议，不自动改价、报名或修改商品信息。",
      metrics: [{ label: "证据数", value: evidenceRefs.length }],
    },
    riskIfIgnored: listItem.riskLevel === "HIGH" ? "可能导致不合规 SKU 继续进入活动准备。" : "可能造成准入结论与实际证据不一致。",
    evidenceRefs,
    relatedRules: item.sourceType === "simulation" ? [toTraceableRef("rule_set", item.sourceId, "相关活动规则")] : [],
    relatedRun: sourceRef,
    approvalHistory,
  };
}

function toWorkbenchReviewStatus(status: ReviewItemDto["status"]): ReviewWorkbenchStatus {
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CHANGES_REQUESTED") return "MODIFIED";
  return "PENDING";
}

function toTraceableRef(entityType: TraceableRef["entityType"], entityId: string, label: string): TraceableRef {
  return { entityType, entityId, label, drawerTarget: `${entityType}:${entityId}` };
}

function toEvidenceRef(ref: EvidenceLinkDto): EvidenceRef {
  const entityTypeByEvidenceType: Record<EvidenceLinkDto["type"], TraceableRef["entityType"]> = {
    snapshot: "sku_snapshot",
    diagnosis: "health_diagnosis",
    rule: "rule_set",
    simulation: "simulation_result",
    review: "review_item",
    report: "report",
    tool_trace: "agent_tool_call",
  };
  const entityType = entityTypeByEvidenceType[ref.type];
  return {
    ...toTraceableRef(entityType, ref.entityId, ref.label || ref.summary || "证据"),
    sourceType: entityType,
    sourceId: ref.entityId,
    evidenceText: ref.summary || ref.label,
  };
}

function toReportDetail(report: ReportPreviewDto, details: SkuDetailDto[], simulations: SimulationResultDto[], reviews: ReviewItemDto[]): ReportDetailDto {
  const passedSku = simulations.filter((item) => item.eligibility === "DIRECT_READY").length || details.filter((item) => item.healthStatus === "READY").length;
  const repairableSku = simulations.filter((item) => item.eligibility === "REPAIRABLE_READY").length || details.filter((item) => item.healthStatus === "WARNING").length;
  const blockedSku = simulations.filter((item) => item.eligibility === "BLOCKED").length || details.filter((item) => item.healthStatus === "BLOCKED").length;
  const evidenceSummary = report.evidenceSummary.map(toEvidenceRef);
  return {
    reportId: report.reportId,
    title: report.title,
    version: "v1",
    status: report.status,
    generatedAt: new Date().toISOString(),
    tabs: ["SUMMARY", "TASKS", "RULES", "EVIDENCE", "REPAIRS"],
    sourceRun: simulations[0] ? toTraceableRef("simulation_result", simulations[0].simulationResultId, "报告来源模拟") : undefined,
    summary: {
      totalSku: details.length,
      passedSku,
      repairableSku,
      blockedSku,
      categoryDistribution: buildCategoryDistribution(details, simulations),
      majorRisks: buildMajorRisks(details, simulations),
      repairSuggestions: buildRepairSuggestions(details, simulations),
      reviewResult: {
        total: reviews.length,
        completed: reviews.filter((item) => item.status !== "OPEN").length,
        approved: reviews.filter((item) => item.status === "APPROVED").length,
        rejected: reviews.filter((item) => item.status === "REJECTED").length,
      },
    },
    evidenceSummary,
  };
}

function buildCategoryDistribution(details: SkuDetailDto[], simulations: SimulationResultDto[]): ReportDetailDto["summary"]["categoryDistribution"] {
  const bySku = new Map(simulations.map((item) => [item.skuProfileId, item]));
  const groups = new Map<string, { passed: number; repairable: number; blocked: number }>();
  for (const detail of details) {
    const category = detail.latestSnapshot?.category ?? "未分类";
    const group = groups.get(category) ?? { passed: 0, repairable: 0, blocked: 0 };
    const eligibility = bySku.get(detail.skuProfileId)?.eligibility;
    if (eligibility === "DIRECT_READY" || (!eligibility && detail.healthStatus === "READY")) group.passed += 1;
    else if (eligibility === "BLOCKED" || detail.healthStatus === "BLOCKED") group.blocked += 1;
    else group.repairable += 1;
    groups.set(category, group);
  }
  return Array.from(groups.entries()).map(([category, group]) => {
    const total = group.passed + group.repairable + group.blocked || 1;
    return { category, ...group, passRate: group.passed / total };
  });
}

function buildMajorRisks(details: SkuDetailDto[], simulations: SimulationResultDto[]): ReportDetailDto["summary"]["majorRisks"] {
  const issues = [...details.flatMap((item) => item.topIssues), ...simulations.flatMap((item) => item.failedRules.map((rule) => rule.message))];
  const total = Math.max(details.length, 1);
  return Array.from(new Set(issues)).slice(0, 5).map((issue) => ({
    riskType: issue,
    affectedSku: issues.filter((item) => item === issue).length,
    ratio: issues.filter((item) => item === issue).length / total,
    sampleIssue: issue,
  }));
}

function buildRepairSuggestions(details: SkuDetailDto[], simulations: SimulationResultDto[]): ReportDetailDto["summary"]["repairSuggestions"] {
  const suggestions = [...details.flatMap((item) => item.nextActions), ...simulations.flatMap((item) => item.repairSuggestions)];
  return Array.from(new Set(suggestions)).slice(0, 5).map((suggestion, index) => ({
    priority: index === 0 ? "P0" : index === 1 ? "P1" : "P2",
    suggestion,
    affectedSku: suggestions.filter((item) => item === suggestion).length,
    estimatedLift: "需重跑模拟确认",
  }));
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toContractHealthStatus(value: unknown): HealthDiagnosisDto["healthStatus"] {
  if (value === "READY") return "READY";
  if (value === "BLOCKED") return "BLOCKED";
  if (value === "RISKY") return "UNKNOWN";
  return "WARNING";
}

function toPrismaEligibility(value: SimulationEligibility): string {
  if (value === "DIRECT_READY") return "DIRECT_READY";
  if (value === "REPAIRABLE_READY") return "REPAIRABLE_READY";
  if (value === "MANUAL_REVIEW") return "MANUAL_REVIEW";
  return "BLOCKED";
}

function toSkuSummaryFromProjection(row: Record<string, unknown>): SkuSummaryDto {
  const profile = row.skuProfile as Record<string, unknown> | undefined;
  return {
    skuProfileId: String(row.skuProfileId),
    canonicalSkuKey: String(profile?.canonicalKey ?? ""),
    productName: String(profile?.productName ?? ""),
    platform: String(profile?.platform ?? ""),
    storeId: String(profile?.storeId ?? ""),
    healthStatus: toContractHealthStatus(row.healthStatus),
    healthScore: Number(row.healthScore ?? 0),
    dataQualityScore: Number(row.dataQualityScore ?? 0),
    topIssues: asArray(row.topIssuesJson).map(String),
    nextActions: [],
  };
}

function toSnapshotDto(row: Record<string, unknown>): NormalizedSkuSnapshotDto {
  return {
    snapshotId: String(row.id),
    skuProfileId: String(row.skuProfileId),
    productName: String(row.productName ?? ""),
    category: typeof row.category === "string" ? row.category : undefined,
    sales30d: Number(row.sales30d ?? 0),
    positiveRate: Number(row.positiveRate ?? 0),
    stock: Number(row.stock ?? 0),
    originalPrice: Number(row.originalPrice ?? 0),
    lowestPrice30d: Number(row.lowestPrice30d ?? 0),
    campaignPrice: Number(row.campaignPrice ?? 0),
    joinedBrandDay: Boolean(row.joinedBrandDay),
    certificateStatus: String(row.certificateStatus ?? "unknown"),
    collectedAt: row.collectedAt instanceof Date ? row.collectedAt.toISOString() : String(row.collectedAt ?? ""),
    raw: isRecord(row.rawJson) ? row.rawJson : {},
    normalized: isRecord(row.normalizedJson) ? row.normalizedJson : {},
  };
}

function toDiagnosisDto(row: Record<string, unknown>): HealthDiagnosisDto {
  return {
    diagnosisId: String(row.id),
    skuProfileId: String(row.skuProfileId),
    snapshotId: String(row.snapshotId ?? ""),
    healthStatus: toContractHealthStatus(row.healthStatus),
    healthScore: Number(row.healthScore ?? 0),
    dataQualityScore: Number(row.dataQualityScore ?? 0),
    issues: asArray(row.issuesJson).map(String),
    nextActions: asArray(row.nextActionsJson).map(String),
    evidence: asArray(row.evidenceJson) as HealthDiagnosisDto["evidence"],
    diagnosedAt: row.diagnosedAt instanceof Date ? row.diagnosedAt.toISOString() : String(row.diagnosedAt ?? ""),
  };
}

function toReviewItemDto(row: Record<string, unknown>): ReviewItemDto {
  const decisionStatus = row.status === "APPROVED" ? "APPROVED" : row.status === "REJECTED" ? "REJECTED" : row.status === "MODIFIED" ? "CHANGES_REQUESTED" : "OPEN";
  return {
    reviewItemId: String(row.id),
    skuProfileId: typeof row.skuProfileId === "string" ? row.skuProfileId : undefined,
    sourceType: toReviewSourceType(row.reviewType),
    sourceId: String(row.simulationResultId ?? row.diagnosisId ?? row.snapshotId ?? row.id),
    question: String(row.question ?? ""),
    recommendation: String(row.agentRecommendation ?? ""),
    riskLevel: String(row.riskLevel ?? "L1") as ReviewItemDto["riskLevel"],
    evidence: asArray(row.evidenceJson) as ReviewItemDto["evidence"],
    status: decisionStatus,
    decision: typeof row.decision === "string" ? (row.decision as ReviewItemDto["decision"]) : undefined,
    decisionBy: typeof row.decisionBy === "string" ? row.decisionBy : undefined,
    decisionComment: typeof row.decisionComment === "string" ? row.decisionComment : undefined,
    decidedAt: row.decidedAt instanceof Date ? row.decidedAt.toISOString() : typeof row.decidedAt === "string" ? row.decidedAt : undefined,
  };
}

function toSimulationResultDto(row: Record<string, unknown>): SimulationResultDto {
  return {
    simulationResultId: String(row.id),
    skuProfileId: String(row.skuProfileId),
    ruleSetId: String(row.activityRuleSetId),
    eligibility: String(row.eligibilityStatus) as SimulationEligibility,
    failedRules: asArray(row.failedRulesJson) as CanonicalRuleDto[],
    evidence: asArray(row.evidenceJson) as SimulationResultDto["evidence"],
    repairSuggestions: asArray(row.repairPlanJson).map(String),
  };
}

function toReviewSourceType(value: unknown): ReviewItemDto["sourceType"] {
  if (value === "health" || value === "simulation" || value === "agent") return value;
  return "agent";
}

function traceRef(entityType: TraceableRef["entityType"], entityId: string, label: string): TraceableRef {
  return { entityType, entityId, label, drawerTarget: `${entityType}:${entityId}` };
}

function evidenceRefFromLink(link: SimulationResultDto["evidence"][number]): EvidenceRef {
  const entityTypeByEvidenceType: Record<typeof link.type, TraceableRef["entityType"]> = {
    snapshot: "sku_snapshot",
    diagnosis: "health_diagnosis",
    rule: "rule_set",
    simulation: "simulation_result",
    review: "review_item",
    report: "report",
    tool_trace: "agent_tool_call",
  };
  const entityType = entityTypeByEvidenceType[link.type];
  return {
    ...traceRef(entityType, link.entityId, link.label),
    sourceType: entityType,
    sourceId: link.entityId,
    evidenceText: link.summary,
  };
}

function extractRequiredFields(rule: CanonicalRuleDto): ActivityExecutionPlanDto["requiredFields"] {
  if (!rule.field && rule.type !== "manual_review") return [];
  if (rule.type === "manual_review") {
    return [{ field: "manual_confirmation", label: "人工确认", status: "AMBIGUOUS_MAPPING", dataSource: "Review 工作台" }];
  }
  const labelByField: Record<string, string> = {
    stock: "活动库存",
    campaignPrice: "活动价",
    certificateStatus: "资质状态",
    sales30d: "近 30 天销量",
    positiveRate: "好评率",
    joinedBrandDay: "品牌日参与状态",
  };
  return [{ field: rule.field!, label: labelByField[rule.field!] ?? rule.field!, status: fieldAvailability(rule.field!), dataSource: "Current SKU Projection", freshness: "latest" }];
}

function fieldAvailability(field: string): RequiredFieldStatus {
  if (field === "manual_confirmation") return "AMBIGUOUS_MAPPING";
  if (field === "certificateStatus") return "EXTERNAL_DEPENDENCY";
  return "READY";
}

function buildPlanSteps(hasRuleSet: boolean, requiredFields: ActivityExecutionPlanDto["requiredFields"], runId: string | undefined, ruleTrace: TraceableRef | undefined): ActivityExecutionPlanDto["steps"] {
  const hasBlockingField = requiredFields.some((item) => item.status !== "READY");
  return [
    { stepKey: "parse_rules", title: "解析活动规则", status: hasRuleSet ? "DONE" : "WAITING", owner: "SYSTEM", toolName: "parseActivityRules", traceRef: ruleTrace },
    { stepKey: "structure_rule_dsl", title: "结构化 Rule DSL", status: hasRuleSet ? "DONE" : "WAITING", owner: "SYSTEM", traceRef: ruleTrace },
    { stepKey: "extract_required_fields", title: "提取必需字段", status: hasRuleSet ? "DONE" : "WAITING", owner: "SYSTEM", outputSummary: `${requiredFields.length} 个字段` },
    { stepKey: "check_data_availability", title: "检查数据可用性", status: hasRuleSet ? (hasBlockingField ? "WAITING" : "DONE") : "WAITING", owner: hasBlockingField ? "OPERATOR" : "SYSTEM" },
    { stepKey: "simulate_readiness", title: "运行准入模拟", status: runId?.startsWith("simulation") ? "DONE" : hasRuleSet && !hasBlockingField ? "WAITING" : "WAITING", owner: "SYSTEM", toolName: "simulateActivityReadiness" },
    { stepKey: "generate_checklist", title: "生成执行清单", status: runId?.startsWith("simulation") ? "DONE" : "WAITING", owner: "AGENT" },
  ];
}

function toActivityDto(row: Record<string, unknown>): ActivityDto {
  const scope = isRecord(row.scopeJson) ? row.scopeJson : {};
  const summary = isRecord(row.summaryJson) ? row.summaryJson : {};
  return {
    activityId: String(row.id),
    name: String(row.name ?? ""),
    platform: typeof row.platform === "string" ? row.platform : undefined,
    categoryScope: asArray(scope.categoryScope).map(String),
    productScopeText: typeof scope.productScopeText === "string" ? scope.productScopeText : "全部当前 SKU",
    status: String(row.status ?? "draft").toUpperCase() as ActivityDto["status"],
    startAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : typeof row.startsAt === "string" ? row.startsAt : undefined,
    endAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : typeof row.endsAt === "string" ? row.endsAt : undefined,
    currentRuleSetId: typeof row.currentRuleSetId === "string" ? row.currentRuleSetId : undefined,
    latestRunId: typeof summary.latestSimulationRunId === "string" ? summary.latestSimulationRunId : typeof row.latestWorkflowRunId === "string" ? row.latestWorkflowRunId : undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

function asScope(value: unknown): ActivitySimulationRunDto["scope"] {
  if (!isRecord(value)) return { skuProfileIds: [] };
  return { skuProfileIds: asArray(value.skuProfileIds).map(String), whatIf: isRecord(value.whatIf) ? value.whatIf as SimulationRequestDto["whatIf"] : undefined };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function toReportDetailFromRow(row: Record<string, unknown>): ReportDetailDto {
  const summary = isRecord(row.summaryJson) ? row.summaryJson : {};
  return {
    reportId: String(row.id),
    title: String(row.title ?? "报告"),
    version: typeof row.latestVersionId === "string" ? row.latestVersionId : "v1",
    status: toReportStatus(row.status),
    generatedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? new Date().toISOString()),
    tabs: ["SUMMARY", "TASKS", "RULES", "EVIDENCE", "REPAIRS"],
    summary: normalizeReportSummary(summary),
    evidenceSummary: [],
  };
}

function toReportVersionFromRow(row: Record<string, unknown>): ReportVersionDto {
  const sections = isRecord(row.sectionsJson) ? row.sectionsJson : {};
  const detail = isReportDetailShape(sections) ? (sections as unknown as ReportDetailDto) : toReportDetailFromRow({ id: row.reportId, title: "报告版本", status: row.status, summaryJson: {}, createdAt: row.createdAt });
  return {
    ...detail,
    reportId: String(row.reportId),
    versionId: String(row.id),
    version: `v${Number(row.version ?? 1)}`,
    status: toReportStatus(row.status),
    generatedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? detail.generatedAt),
    evidenceSummary: asArray(row.evidenceRefsJson) as EvidenceRef[],
  };
}

function normalizeReportSummary(value: Record<string, unknown>): ReportDetailDto["summary"] {
  return {
    totalSku: Number(value.totalSku ?? 0),
    passedSku: Number(value.passedSku ?? 0),
    repairableSku: Number(value.repairableSku ?? 0),
    blockedSku: Number(value.blockedSku ?? 0),
    categoryDistribution: asArray(value.categoryDistribution) as ReportDetailDto["summary"]["categoryDistribution"],
    majorRisks: asArray(value.majorRisks) as ReportDetailDto["summary"]["majorRisks"],
    repairSuggestions: asArray(value.repairSuggestions) as ReportDetailDto["summary"]["repairSuggestions"],
    reviewResult: isRecord(value.reviewResult) ? {
      total: Number(value.reviewResult.total ?? 0),
      completed: Number(value.reviewResult.completed ?? 0),
      approved: Number(value.reviewResult.approved ?? 0),
      rejected: Number(value.reviewResult.rejected ?? 0),
    } : { total: 0, completed: 0, approved: 0, rejected: 0 },
  };
}

function toReportStatus(value: unknown): ReportDetailDto["status"] {
  if (value === "GENERATING" || value === "COMPLETED" || value === "FAILED") return value;
  return "PREVIEW";
}

function isReportDetailShape(value: Record<string, unknown>): boolean {
  return typeof value.reportId === "string" && typeof value.title === "string" && isRecord(value.summary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createFinalApiPersistenceRuntime(options: { adapter?: "memory" | "prisma"; prisma?: PrismaPersistenceClient; boundary?: PersistenceBoundary } = {}) {
  const adapter = options.adapter ?? (process.env.PICKAGENT_PERSISTENCE_ADAPTER === "memory" ? "memory" : process.env.PICKAGENT_PERSISTENCE_ADAPTER === "prisma" || process.env.NODE_ENV === "production" || process.env.DATABASE_URL ? "prisma" : "memory");
  if (adapter === "prisma") {
    if (!options.prisma) throw new Error("Prisma persistence adapter requires a Prisma client. Pass { prisma } from the runtime bootstrap.");
    const tx = new PrismaTransactionManager(options.prisma, options.boundary);
    const skuQueryRepository = new PrismaSkuQueryRepository(options.prisma);
    const dashboardSkuRepository = new PrismaDashboardSkuReadModelRepository(options.prisma);
    const ingestService = new FinalIngestService(tx, new PrismaIngestRepository(), skuQueryRepository);
    const skuReadinessQueryService = new SkuReadinessQueryService(dashboardSkuRepository);
    const activityService = new FinalActivityService(new PrismaActivityRepository(options.prisma), skuQueryRepository);
    const memoryStore = new FinalApiPersistenceStore();
    const reviewService = new FinalReviewService(new PrismaReviewRepository(options.prisma));
    const reportService = new FinalReportService(new PrismaReportRepository(options.prisma), skuQueryRepository);
    return { adapter, store: memoryStore, tx, ingestService, skuReadinessQueryService, activityService, reviewService, reportService };
  }
  const store = new FinalApiPersistenceStore();
  const tx = new InMemoryTransactionManager(store);
  const skuQueryRepository = new SkuQueryRepository(store);
  const dashboardSkuRepository = new DashboardSkuReadModelRepository(store);
  const ingestService = new FinalIngestService(tx, new IngestRepository(), skuQueryRepository);
  const skuReadinessQueryService = new SkuReadinessQueryService(dashboardSkuRepository);
  const activityService = new FinalActivityService(new ActivityRepository(store), skuQueryRepository);
  const reviewService = new FinalReviewService(new ReviewRepository(store));
  const reportService = new FinalReportService(new ReportRepository(store), skuQueryRepository);
  return { adapter, store, tx, ingestService, skuReadinessQueryService, activityService, reviewService, reportService };
}
