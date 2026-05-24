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
  EvidenceRef,
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
  TraceableRef,
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
  activityRuleSet: PrismaDelegate;
  activitySimulationRun: PrismaDelegate;
  activitySimulationResult: PrismaDelegate;
  reviewItem: PrismaDelegate;
  workflowRun: PrismaDelegate;
  report?: PrismaDelegate;
  reportVersion?: PrismaDelegate;
}

export class FinalApiPersistenceStore {
  readonly profilesByCanonicalKey = new Map<string, SkuProfileRecord>();
  readonly profilesById = new Map<string, SkuProfileRecord>();
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

export class ActivityRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

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

export class PrismaActivityRepository extends ActivityRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
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

function toReviewSourceType(value: unknown): ReviewItemDto["sourceType"] {
  if (value === "health" || value === "simulation" || value === "agent") return value;
  return "agent";
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
    const ingestService = new FinalIngestService(tx, new PrismaIngestRepository(), skuQueryRepository);
    const activityService = new FinalActivityService(new PrismaActivityRepository(options.prisma), skuQueryRepository);
    const memoryStore = new FinalApiPersistenceStore();
    const reviewService = new FinalReviewService(new PrismaReviewRepository(options.prisma));
    const reportService = new FinalReportService(new PrismaReportRepository(options.prisma), skuQueryRepository);
    return { adapter, store: memoryStore, tx, ingestService, activityService, reviewService, reportService };
  }
  const store = new FinalApiPersistenceStore();
  const tx = new InMemoryTransactionManager(store);
  const skuQueryRepository = new SkuQueryRepository(store);
  const ingestService = new FinalIngestService(tx, new IngestRepository(), skuQueryRepository);
  const activityService = new FinalActivityService(new ActivityRepository(store), skuQueryRepository);
  const reviewService = new FinalReviewService(new ReviewRepository(store));
  const reportService = new FinalReportService(new ReportRepository(store), skuQueryRepository);
  return { adapter, store, tx, ingestService, activityService, reviewService, reportService };
}
