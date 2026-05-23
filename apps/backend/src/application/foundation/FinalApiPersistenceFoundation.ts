import {
  type ActivityRuleSetDto,
  type CanonicalRuleDto,
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
import { HealthAssessmentService, NormalizationService } from "./BusinessFoundationServices";

declare const process: { env: Record<string, string | undefined> };

export interface ApiEnvelope<T> {
  code: "OK" | "COMMON.VALIDATION_ERROR" | "SKU.NOT_FOUND" | "RULE.PARSE_FAILED" | "REVIEW.NOT_FOUND";
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
}

export interface ReportRequestDto {
  type: "HEALTH" | "ACTIVITY";
  skuProfileIds: string[];
  simulationResultIds?: string[];
}

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
  readonly workflowAudits = new Map<string, WorkflowAuditRecord>();
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
    input: { row: IngestRowDto; collectedAt: string; snapshot: NormalizedSkuSnapshotDto; diagnosis: HealthDiagnosisDto },
  ): SkuSummaryDto | Promise<SkuSummaryDto> {
    const key = canonicalSkuKey(input.row);
    const profile =
      tx.store!.profilesByCanonicalKey.get(key) ??
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
    return summary;
  }

  recordWorkflowAudit(tx: TransactionContext, record: Omit<WorkflowAuditRecord, "workflowRunId" | "createdAt" | "status">): WorkflowAuditRecord | Promise<WorkflowAuditRecord> {
    const audit: WorkflowAuditRecord = { ...record, workflowRunId: nextId("workflow"), status: "SUCCEEDED", createdAt: new Date().toISOString() };
    tx.store!.workflowAudits.set(audit.workflowRunId, audit);
    return audit;
  }
}

export class SkuQueryRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  healthSummary(): HealthSummaryDto | Promise<HealthSummaryDto> {
    const summaries = Array.from(this.store.projections.values());
    return {
      total: summaries.length,
      ready: summaries.filter((item) => item.healthStatus === "READY").length,
      warning: summaries.filter((item) => item.healthStatus === "WARNING").length,
      blocked: summaries.filter((item) => item.healthStatus === "BLOCKED").length,
    };
  }

  list(page = 1, pageSize = 20): PageDto<SkuSummaryDto> | Promise<PageDto<SkuSummaryDto>> {
    const items = Array.from(this.store.projections.values());
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
  }

  detail(skuProfileId: string): SkuDetailDto | null | Promise<SkuDetailDto | null> {
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
}

export class ActivityRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  saveRuleSet(ruleSet: ActivityRuleSetDto): ActivityRuleSetDto | Promise<ActivityRuleSetDto> {
    this.store.ruleSets.set(ruleSet.ruleSetId, ruleSet);
    return ruleSet;
  }

  getRuleSet(activityRuleSetId: string): ActivityRuleSetDto | null | Promise<ActivityRuleSetDto | null> {
    return this.store.ruleSets.get(activityRuleSetId) ?? null;
  }

  saveSimulationRun(run: ActivitySimulationRunDto): ActivitySimulationRunDto | Promise<ActivitySimulationRunDto> {
    this.store.simulationRuns.set(run.simulationRunId, run);
    for (const result of run.results) {
      this.store.simulationResults.set(result.simulationResultId, result);
    }
    return run;
  }
}

export class ReviewRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  list(): ReviewItemDto[] | Promise<ReviewItemDto[]> {
    return Array.from(this.store.reviews.values());
  }

  async create(items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): Promise<ReviewItemDto[]> {
    return items.map((item) => {
      const review: ReviewItemDto = { ...item, reviewItemId: nextId("review"), status: "OPEN" };
      this.store.reviews.set(review.reviewItemId, review);
      return review;
    });
  }

  async decide(reviewItemId: string, request: ReviewDecisionRequestDto): Promise<ReviewItemDto> {
    const current = this.store.reviews.get(reviewItemId);
    if (!current) throw new Error(`Review item not found: ${reviewItemId}`);
    const statusByDecision = { APPROVE: "APPROVED", REJECT: "REJECTED", REQUEST_CHANGES: "CHANGES_REQUESTED" } as const;
    const updated: ReviewItemDto = { ...current, status: statusByDecision[request.decision], decision: request.decision, decisionBy: request.decisionBy, decisionComment: request.decisionComment, decidedAt: new Date().toISOString() };
    this.store.reviews.set(reviewItemId, updated);
    return updated;
  }
}

export class ReportRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  save(report: ReportPreviewDto): ReportPreviewDto | Promise<ReportPreviewDto> {
    this.store.reports.set(report.reportId, report);
    return report;
  }

  getSimulationResult(id: string): SimulationResultDto | null | Promise<SimulationResultDto | null> {
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
    input: { row: IngestRowDto; collectedAt: string; snapshot: NormalizedSkuSnapshotDto; diagnosis: HealthDiagnosisDto },
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

  async recordWorkflowAudit(tx: TransactionContext, record: Omit<WorkflowAuditRecord, "workflowRunId" | "createdAt" | "status">): Promise<WorkflowAuditRecord> {
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

  async healthSummary(): Promise<HealthSummaryDto> {
    const rows = await this.prisma.currentSkuProjection.findMany();
    return {
      total: rows.length,
      ready: rows.filter((item) => item.healthStatus === "READY").length,
      warning: rows.filter((item) => item.healthStatus === "REPAIRABLE" || item.healthStatus === "RISKY").length,
      blocked: rows.filter((item) => item.healthStatus === "BLOCKED").length,
    };
  }

  async list(page = 1, pageSize = 20): Promise<PageDto<SkuSummaryDto>> {
    const rows = await this.prisma.currentSkuProjection.findMany({
      include: { skuProfile: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.currentSkuProjection.count();
    return { items: rows.map(toSkuSummaryFromProjection), page, pageSize, total };
  }

  async detail(skuProfileId: string): Promise<SkuDetailDto | null> {
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

  async saveRuleSet(ruleSet: ActivityRuleSetDto): Promise<ActivityRuleSetDto> {
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

  async getRuleSet(activityRuleSetId: string): Promise<ActivityRuleSetDto | null> {
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

  async saveSimulationRun(run: ActivitySimulationRunDto): Promise<ActivitySimulationRunDto> {
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

  async list(): Promise<ReviewItemDto[]> {
    const rows = await this.prisma.reviewItem.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toReviewItemDto);
  }

  async create(items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): Promise<ReviewItemDto[]> {
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

  async decide(reviewItemId: string, request: ReviewDecisionRequestDto): Promise<ReviewItemDto> {
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
    return toReviewItemDto(updated);
  }
}

export class PrismaReportRepository extends ReportRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async save(report: ReportPreviewDto): Promise<ReportPreviewDto> {
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

  async getSimulationResult(id: string): Promise<SimulationResultDto | null> {
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

  async ingest(payload: IngestPayloadDto): Promise<IngestResponseDto> {
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
        summaries.push(await this.repository.upsertIngestAggregate(tx, { row, collectedAt: payload.collectedAt, snapshot, diagnosis }));
        snapshots.push(snapshot);
        diagnoses.push(diagnosis);
      }
      const audit = await this.repository.recordWorkflowAudit(tx, {
        workflowType: "ingest",
        subjectType: "sku_batch",
        input: { connectorId: payload.connectorId, rowCount: payload.rows.length, collectedAt: payload.collectedAt },
        output: { skuProfileIds: summaries.map((item) => item.skuProfileId) },
      });
      return { summaries, snapshots, diagnoses, workflowRunId: audit.workflowRunId };
    });
  }

  async getHealthSummary(): Promise<HealthSummaryDto> {
    return this.skuQueryRepository.healthSummary();
  }

  async listSkus(page?: number, pageSize?: number): Promise<PageDto<SkuSummaryDto>> {
    return this.skuQueryRepository.list(page, pageSize);
  }

  async getSkuDetail(skuProfileId: string): Promise<SkuDetailDto | null> {
    return this.skuQueryRepository.detail(skuProfileId);
  }
}

export class FinalActivityService {
  constructor(private readonly repository: ActivityRepository, private readonly skuQueryRepository: SkuQueryRepository) {}

  async parse(input: { name: string; platform?: string; sourceText: string; rules?: CanonicalRuleDto[] }): Promise<ActivityRuleSetDto> {
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
    return this.repository.saveRuleSet(ruleSet);
  }

  async simulate(activityRuleSetId: string, request: Omit<SimulationRequestDto, "ruleSetId">): Promise<ActivitySimulationRunDto> {
    const ruleSet = await this.repository.getRuleSet(activityRuleSetId);
    if (!ruleSet || ruleSet.parseStatus === "FAILED") throw new Error("Valid rule set is required before simulation");
    const startedAt = new Date().toISOString();
    const results = await Promise.all(request.skuProfileIds.map(async (skuProfileId) => {
      const detail = await this.skuQueryRepository.detail(skuProfileId);
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
    return this.repository.saveSimulationRun({
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

  async list(): Promise<PageDto<ReviewItemDto>> {
    const items = await this.repository.list();
    return { items, page: 1, pageSize: items.length || 20, total: items.length };
  }

  async create(items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): Promise<ReviewItemDto[]> {
    return this.repository.create(items);
  }

  async decide(reviewItemId: string, request: ReviewDecisionRequestDto): Promise<ReviewItemDto> {
    return this.repository.decide(reviewItemId, request);
  }
}

export class FinalReportService {
  constructor(private readonly repository: ReportRepository, private readonly skuQueryRepository: SkuQueryRepository) {}

  async generate(input: ReportRequestDto): Promise<ReportPreviewDto> {
    const details = (await Promise.all(input.skuProfileIds.map((id) => this.skuQueryRepository.detail(id)))).filter((item): item is SkuDetailDto => item !== null);
    const simulations = (await Promise.all((input.simulationResultIds ?? []).map((id) => this.repository.getSimulationResult(id)))).filter((item): item is SimulationResultDto => item !== null);
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
    return this.repository.save(report);
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
