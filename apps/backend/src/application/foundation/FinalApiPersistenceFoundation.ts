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
  type RuleSetDetailDto,
  type RuleSetListItemDto,
  type RuleSetSourceDto,
  type RuleSetStatusDto,
  type RuleSetTypeDto,
  type RuleSetVersionDto,
  type SimulationEligibility,
  type SimulationRequestDto,
  type SimulationResultDto,
  type SkuDetailDto,
  type SkuSummaryDto,
  type SettingsUserDto,
  type ToolPolicyDto,
  type TraceableRefDto,
  type WorkspaceSettingsDto,
  assertValidIngestPayload,
  assertValidRuleSet,
} from "../../../../contracts/types/businessFoundation";
import { HealthAssessmentService, NormalizationService } from "./BusinessFoundationServices";
import { assertTenantBoundary, type P0AuthContextDto } from "./P0AuthBoundaryRuntimeConfig";

declare const process: { env: Record<string, string | undefined> };

export interface ApiEnvelope<T> {
  code: "OK" | "COMMON.VALIDATION_ERROR" | "SKU.NOT_FOUND" | "RULE.PARSE_FAILED" | "REVIEW.NOT_FOUND" | "AGENT.REAL_CHAT_NOT_CONFIGURED";
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

export interface CreateRuleSetInputDto {
  name: string;
  sourceText: string;
  platform?: string;
  type?: RuleSetTypeDto;
  source?: RuleSetSourceDto;
  status?: RuleSetStatusDto;
  rules?: CanonicalRuleDto[];
}

export interface UpdateRuleSetInputDto {
  name?: string;
  sourceText?: string;
  platform?: string;
  rules?: CanonicalRuleDto[];
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
  ruleSetVersion: PrismaDelegate;
  activitySimulationRun: PrismaDelegate;
  activitySimulationResult: PrismaDelegate;
  reviewItem: PrismaDelegate;
  workflowRun: PrismaDelegate;
  workspaceSetting: PrismaDelegate;
}

export class FinalApiPersistenceStore {
  readonly profilesByCanonicalKey = new Map<string, SkuProfileRecord>();
  readonly profilesById = new Map<string, SkuProfileRecord>();
  readonly snapshots = new Map<string, NormalizedSkuSnapshotDto>();
  readonly diagnoses = new Map<string, HealthDiagnosisDto>();
  readonly projections = new Map<string, SkuSummaryDto>();
  readonly ruleSets = new Map<string, ActivityRuleSetDto>();
  readonly ruleSetVersions = new Map<string, RuleSetVersionDto>();
  readonly ruleSetMetadata = new Map<string, RuleSetMetadata>();
  readonly simulationRuns = new Map<string, ActivitySimulationRunDto>();
  readonly simulationResults = new Map<string, SimulationResultDto>();
  readonly reviews = new Map<string, ReviewItemDto>();
  readonly reports = new Map<string, ReportPreviewDto>();
  readonly workflowAudits = new Map<string, WorkflowAuditRecord>();
  readonly tenantByEntityId = new Map<string, string>();
}

interface RuleSetMetadata {
  type: RuleSetTypeDto;
  source: RuleSetSourceDto;
  status: RuleSetStatusDto;
  version: string;
  updatedAt: string;
  updatedBy: string;
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

export class RuleSetRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  list(boundary: P0AuthContextDto, page = 1, pageSize = 20): PageDto<RuleSetListItemDto> | Promise<PageDto<RuleSetListItemDto>> {
    const rows = Array.from(this.store.ruleSets.values()).filter((item) => this.store.tenantByEntityId.get(item.ruleSetId) === boundary.tenantId);
    const items = rows.map((ruleSet) => this.toListItem(ruleSet)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
  }

  getDetail(boundary: P0AuthContextDto, ruleSetId: string): RuleSetDetailDto | null | Promise<RuleSetDetailDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(ruleSetId), ruleSetId);
    const ruleSet = this.store.ruleSets.get(ruleSetId);
    return ruleSet ? assembleRuleSetDetail(this.toListItem(ruleSet), ruleSet, this.relatedRuns(ruleSetId)) : null;
  }

  create(boundary: P0AuthContextDto, input: CreateRuleSetInputDto): RuleSetDetailDto | Promise<RuleSetDetailDto> {
    const ruleSet: ActivityRuleSetDto = {
      ruleSetId: nextId("rules"),
      name: input.name,
      platform: input.platform,
      sourceText: input.sourceText,
      rules: input.rules ?? deterministicRules(input.sourceText),
      parseStatus: "PARSED",
      confidence: 0.9,
      errors: [],
    };
    assertValidRuleSet(ruleSet);
    const now = new Date().toISOString();
    this.store.ruleSets.set(ruleSet.ruleSetId, ruleSet);
    this.store.ruleSetMetadata.set(ruleSet.ruleSetId, {
      type: input.type ?? "ACTIVITY_RULE",
      source: input.source ?? "INTERNAL",
      status: input.status ?? "DRAFT",
      version: "v1",
      updatedAt: now,
      updatedBy: boundary.actorId,
    });
    const version = this.toVersion(ruleSet, 1, this.store.ruleSetMetadata.get(ruleSet.ruleSetId)!.status, now, boundary.actorId);
    this.store.ruleSetVersions.set(version.ruleSetVersionId, version);
    this.store.tenantByEntityId.set(ruleSet.ruleSetId, boundary.tenantId);
    this.store.tenantByEntityId.set(version.ruleSetVersionId, boundary.tenantId);
    return assembleRuleSetDetail(this.toListItem(ruleSet), ruleSet, []);
  }

  update(boundary: P0AuthContextDto, ruleSetId: string, input: UpdateRuleSetInputDto): RuleSetDetailDto | Promise<RuleSetDetailDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(ruleSetId), ruleSetId);
    const current = this.store.ruleSets.get(ruleSetId);
    if (!current) throw new Error(`Rule set not found: ${ruleSetId}`);
    const updated: ActivityRuleSetDto = {
      ...current,
      name: input.name ?? current.name,
      platform: input.platform ?? current.platform,
      sourceText: input.sourceText ?? current.sourceText,
      rules: input.rules ?? (input.sourceText ? deterministicRules(input.sourceText) : current.rules),
    };
    assertValidRuleSet(updated);
    this.store.ruleSets.set(ruleSetId, updated);
    this.store.ruleSetMetadata.set(ruleSetId, { ...this.metadata(ruleSetId), updatedAt: new Date().toISOString(), updatedBy: boundary.actorId });
    return assembleRuleSetDetail(this.toListItem(updated), updated, this.relatedRuns(ruleSetId));
  }

  setStatus(boundary: P0AuthContextDto, ruleSetId: string, status: RuleSetStatusDto): RuleSetDetailDto | Promise<RuleSetDetailDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(ruleSetId), ruleSetId);
    const current = this.store.ruleSets.get(ruleSetId);
    if (!current) throw new Error(`Rule set not found: ${ruleSetId}`);
    this.store.ruleSetMetadata.set(ruleSetId, { ...this.metadata(ruleSetId), status, updatedAt: new Date().toISOString(), updatedBy: boundary.actorId });
    return assembleRuleSetDetail(this.toListItem(current), current, this.relatedRuns(ruleSetId));
  }

  createVersion(boundary: P0AuthContextDto, ruleSetId: string): RuleSetVersionDto | Promise<RuleSetVersionDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(ruleSetId), ruleSetId);
    const ruleSet = this.store.ruleSets.get(ruleSetId);
    if (!ruleSet) throw new Error(`Rule set not found: ${ruleSetId}`);
    const versions = Array.from(this.store.ruleSetVersions.values()).filter((item) => item.ruleSetId === ruleSetId);
    const nextVersion = versions.length + 1;
    const createdAt = new Date().toISOString();
    const version = this.toVersion(ruleSet, nextVersion, this.metadata(ruleSetId).status, createdAt, boundary.actorId);
    this.store.ruleSetVersions.set(version.ruleSetVersionId, version);
    this.store.ruleSetMetadata.set(ruleSetId, { ...this.metadata(ruleSetId), version: `v${nextVersion}`, updatedAt: createdAt, updatedBy: boundary.actorId });
    this.store.tenantByEntityId.set(version.ruleSetVersionId, boundary.tenantId);
    return version;
  }

  listVersions(boundary: P0AuthContextDto, ruleSetId: string): RuleSetVersionDto[] | Promise<RuleSetVersionDto[]> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(ruleSetId), ruleSetId);
    return Array.from(this.store.ruleSetVersions.values()).filter((item) => item.ruleSetId === ruleSetId).sort((a, b) => b.version.localeCompare(a.version));
  }

  private metadata(ruleSetId: string): RuleSetMetadata {
    return this.store.ruleSetMetadata.get(ruleSetId) ?? defaultRuleSetMetadata();
  }

  private toListItem(ruleSet: ActivityRuleSetDto): RuleSetListItemDto {
    const metadata = this.metadata(ruleSet.ruleSetId);
    return {
      ruleSetId: ruleSet.ruleSetId,
      name: ruleSet.name,
      type: metadata.type,
      version: metadata.version,
      status: metadata.status,
      source: metadata.source,
      updatedAt: metadata.updatedAt,
      updatedBy: metadata.updatedBy,
      activeRunCount: this.relatedRuns(ruleSet.ruleSetId).length,
    };
  }

  private toVersion(ruleSet: ActivityRuleSetDto, version: number, status: RuleSetStatusDto, createdAt: string, createdBy: string): RuleSetVersionDto {
    const detail = assembleRuleSetDetail({ ...this.toListItem(ruleSet), version: `v${version}`, status }, ruleSet, []);
    return {
      ruleSetVersionId: nextId("rule_version"),
      ruleSetId: ruleSet.ruleSetId,
      version: `v${version}`,
      status,
      sourceText: ruleSet.sourceText,
      dslJson: ruleSet.rules,
      affectedFields: detail.affectedFields,
      manualReviewItems: detail.manualReviewItems,
      createdAt,
      createdBy,
    };
  }

  private relatedRuns(ruleSetId: string): TraceableRefDto[] {
    return Array.from(this.store.simulationRuns.values())
      .filter((run) => run.activityRuleSetId === ruleSetId)
      .map((run) => ({ entityType: "simulation_run", entityId: run.simulationRunId, label: `规则运行 ${run.simulationRunId}`, drawerTarget: "simulation_run" }));
  }
}

export class WorkspaceSettingsRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  getWorkspace(_boundary: P0AuthContextDto): WorkspaceSettingsDto | Promise<WorkspaceSettingsDto> {
    return defaultWorkspaceSettings();
  }

  updateWorkspace(_boundary: P0AuthContextDto, input: Partial<WorkspaceSettingsDto>): WorkspaceSettingsDto | Promise<WorkspaceSettingsDto> {
    return normalizeWorkspaceSettings({ ...defaultWorkspaceSettings(), ...input });
  }

  getToolPolicy(boundary: P0AuthContextDto): ToolPolicyDto | Promise<ToolPolicyDto> {
    const workspace = this.getWorkspace(boundary) as WorkspaceSettingsDto;
    return toToolPolicy(workspace, boundary.actorId);
  }

  updateToolPolicy(boundary: P0AuthContextDto, input: Partial<ToolPolicyDto>): ToolPolicyDto | Promise<ToolPolicyDto> {
    return toToolPolicy(normalizeWorkspaceSettings({ ...defaultWorkspaceSettings(), allowedAgentTools: input.allowedAgentTools, deniedRuntimeTools: input.deniedRuntimeTools }), boundary.actorId);
  }

  listUsers(_boundary: P0AuthContextDto): SettingsUserDto[] | Promise<SettingsUserDto[]> {
    return defaultSettingsUsers();
  }
}

export class ReviewRepository {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  list(boundary: P0AuthContextDto): ReviewItemDto[] | Promise<ReviewItemDto[]> {
    return Array.from(this.store.reviews.values()).filter((item) => this.store.tenantByEntityId.get(item.reviewItemId) === boundary.tenantId);
  }

  create(boundary: P0AuthContextDto, items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): ReviewItemDto[] | Promise<ReviewItemDto[]> {
    return items.map((item) => {
      if (item.skuProfileId) assertTenantBoundary(boundary, this.store.tenantByEntityId.get(item.skuProfileId), item.skuProfileId);
      const review: ReviewItemDto = { ...item, reviewItemId: nextId("review"), status: "OPEN" };
      this.store.reviews.set(review.reviewItemId, review);
      this.store.tenantByEntityId.set(review.reviewItemId, boundary.tenantId);
      return review;
    });
  }

  decide(boundary: P0AuthContextDto, reviewItemId: string, request: ReviewDecisionRequestDto): ReviewItemDto | Promise<ReviewItemDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reviewItemId), reviewItemId);
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

  save(boundary: P0AuthContextDto, report: ReportPreviewDto): ReportPreviewDto | Promise<ReportPreviewDto> {
    this.store.reports.set(report.reportId, report);
    this.store.tenantByEntityId.set(report.reportId, boundary.tenantId);
    return report;
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

export class PrismaRuleSetRepository extends RuleSetRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async list(_boundary: P0AuthContextDto, page = 1, pageSize = 20): Promise<PageDto<RuleSetListItemDto>> {
    const rows = await this.prisma.activityRuleSet.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
    const total = await this.prisma.activityRuleSet.count();
    const items = await Promise.all(rows.map((row) => this.toListItemFromRow(row)));
    return { items, page, pageSize, total };
  }

  async getDetail(_boundary: P0AuthContextDto, ruleSetId: string): Promise<RuleSetDetailDto | null> {
    const row = await this.prisma.activityRuleSet.findUnique({ where: { id: ruleSetId } });
    if (!row) return null;
    return assembleRuleSetDetail(await this.toListItemFromRow(row), toRuleSetDto(row), await this.prismaRelatedRuns(ruleSetId));
  }

  async create(boundary: P0AuthContextDto, input: CreateRuleSetInputDto): Promise<RuleSetDetailDto> {
    const ruleSetId = nextUuid();
    const rules = input.rules ?? deterministicRules(input.sourceText);
    const row = await this.prisma.activityRuleSet.create({
      data: {
        id: ruleSetId,
        name: input.name,
        platform: input.platform,
        sourceText: input.sourceText,
        rulesJson: rules,
        parseConfidence: 0.9,
        parseStatus: "parsed",
        parseMetadataJson: { type: input.type ?? "ACTIVITY_RULE", source: input.source ?? "INTERNAL", status: input.status ?? "DRAFT", version: "v1", updatedBy: boundary.actorId },
        createdBy: boundary.actorId,
      },
    });
    await this.prisma.ruleSetVersion.create({
      data: {
        id: nextUuid(),
        ruleSetId,
        version: 1,
        status: String(input.status ?? "DRAFT").toLowerCase(),
        sourceText: input.sourceText,
        rulesJson: rules,
        requiredFieldsJson: extractAffectedFields(rules),
        confirmationsJson: extractManualReviewItems(rules),
        metadataJson: { createdBy: boundary.actorId },
        createdBy: boundary.actorId,
      },
    });
    return assembleRuleSetDetail(await this.toListItemFromRow(row), toRuleSetDto(row), []);
  }

  async update(boundary: P0AuthContextDto, ruleSetId: string, input: UpdateRuleSetInputDto): Promise<RuleSetDetailDto> {
    const current = await this.prisma.activityRuleSet.findUnique({ where: { id: ruleSetId } });
    if (!current) throw new Error(`Rule set not found: ${ruleSetId}`);
    const rules = input.rules ?? (input.sourceText ? deterministicRules(input.sourceText) : asArray(current.rulesJson) as CanonicalRuleDto[]);
    const row = await this.prisma.activityRuleSet.update({
      where: { id: ruleSetId },
      data: {
        name: input.name,
        platform: input.platform,
        sourceText: input.sourceText,
        rulesJson: rules,
        parseMetadataJson: { ...asRecord(current.parseMetadataJson), updatedBy: boundary.actorId },
      },
    });
    return assembleRuleSetDetail(await this.toListItemFromRow(row), toRuleSetDto(row), await this.prismaRelatedRuns(ruleSetId));
  }

  async setStatus(boundary: P0AuthContextDto, ruleSetId: string, status: RuleSetStatusDto): Promise<RuleSetDetailDto> {
    const current = await this.prisma.activityRuleSet.findUnique({ where: { id: ruleSetId } });
    if (!current) throw new Error(`Rule set not found: ${ruleSetId}`);
    const row = await this.prisma.activityRuleSet.update({
      where: { id: ruleSetId },
      data: { parseMetadataJson: { ...asRecord(current.parseMetadataJson), status, updatedBy: boundary.actorId } },
    });
    return assembleRuleSetDetail(await this.toListItemFromRow(row), toRuleSetDto(row), await this.prismaRelatedRuns(ruleSetId));
  }

  async createVersion(boundary: P0AuthContextDto, ruleSetId: string): Promise<RuleSetVersionDto> {
    const row = await this.prisma.activityRuleSet.findUnique({ where: { id: ruleSetId } });
    if (!row) throw new Error(`Rule set not found: ${ruleSetId}`);
    const existing = await this.prisma.ruleSetVersion.findMany({ where: { ruleSetId }, orderBy: { version: "desc" }, take: 1 });
    const version = Number(existing[0]?.version ?? 0) + 1;
    const created = await this.prisma.ruleSetVersion.create({
      data: {
        id: nextUuid(),
        ruleSetId,
        version,
        status: String(ruleSetStatusFromMetadata(row.parseMetadataJson)).toLowerCase(),
        sourceText: String(row.sourceText),
        rulesJson: asArray(row.rulesJson),
        requiredFieldsJson: extractAffectedFields(asArray(row.rulesJson) as CanonicalRuleDto[]),
        confirmationsJson: extractManualReviewItems(asArray(row.rulesJson) as CanonicalRuleDto[]),
        metadataJson: { createdBy: boundary.actorId },
        createdBy: boundary.actorId,
      },
    });
    await this.prisma.activityRuleSet.update({ where: { id: ruleSetId }, data: { parseMetadataJson: { ...asRecord(row.parseMetadataJson), version: `v${version}`, updatedBy: boundary.actorId } } });
    return toRuleSetVersionDto(created);
  }

  async listVersions(_boundary: P0AuthContextDto, ruleSetId: string): Promise<RuleSetVersionDto[]> {
    const rows = await this.prisma.ruleSetVersion.findMany({ where: { ruleSetId }, orderBy: { version: "desc" } });
    return rows.map(toRuleSetVersionDto);
  }

  private async toListItemFromRow(row: Record<string, unknown>): Promise<RuleSetListItemDto> {
    return {
      ruleSetId: String(row.id),
      name: String(row.name),
      type: ruleSetTypeFromMetadata(row.parseMetadataJson),
      version: String(asRecord(row.parseMetadataJson).version ?? "v1"),
      status: ruleSetStatusFromMetadata(row.parseMetadataJson),
      source: ruleSetSourceFromMetadata(row.parseMetadataJson),
      updatedAt: dateString(row.updatedAt),
      updatedBy: String(asRecord(row.parseMetadataJson).updatedBy ?? row.createdBy ?? "system"),
      activeRunCount: await this.prisma.activitySimulationRun.count({ where: { activityRuleSetId: String(row.id) } }),
    };
  }

  private async prismaRelatedRuns(ruleSetId: string): Promise<TraceableRefDto[]> {
    const rows = await this.prisma.activitySimulationRun.findMany({ where: { activityRuleSetId: ruleSetId }, orderBy: { startedAt: "desc" }, take: 10 });
    return rows.map((run) => ({ entityType: "simulation_run", entityId: String(run.id), label: `规则运行 ${String(run.id).slice(0, 8)}`, drawerTarget: "simulation_run" }));
  }
}

export class PrismaWorkspaceSettingsRepository extends WorkspaceSettingsRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async getWorkspace(_boundary: P0AuthContextDto): Promise<WorkspaceSettingsDto> {
    const rows = await this.prisma.workspaceSetting.findMany({ where: { status: "active" } });
    return normalizeWorkspaceSettings(settingsRowsToWorkspace(rows));
  }

  async updateWorkspace(boundary: P0AuthContextDto, input: Partial<WorkspaceSettingsDto>): Promise<WorkspaceSettingsDto> {
    const current = await this.getWorkspace(boundary);
    const next = normalizeWorkspaceSettings({ ...current, ...input });
    await this.upsert("workspace", "freshness_thresholds", { dataFreshnessThresholdHours: next.dataFreshnessThresholdHours }, boundary.actorId);
    await this.upsert("workspace", "review_sla", next.reviewSlaHours, boundary.actorId);
    await this.upsert("agent", "tool_policy", { allowedAgentTools: next.allowedAgentTools, deniedRuntimeTools: next.deniedRuntimeTools, policyVersion: "p0" }, boundary.actorId);
    return next;
  }

  async getToolPolicy(boundary: P0AuthContextDto): Promise<ToolPolicyDto> {
    const row = (await this.prisma.workspaceSetting.findMany({ where: { namespace: "agent", settingKey: "tool_policy" }, take: 1 }))[0];
    const workspace = normalizeWorkspaceSettings({ ...defaultWorkspaceSettings(), ...asRecord(row?.settingJson) });
    return toToolPolicy(workspace, boundary.actorId, dateString(row?.updatedAt));
  }

  async updateToolPolicy(boundary: P0AuthContextDto, input: Partial<ToolPolicyDto>): Promise<ToolPolicyDto> {
    const workspace = normalizeWorkspaceSettings({ ...defaultWorkspaceSettings(), allowedAgentTools: input.allowedAgentTools, deniedRuntimeTools: input.deniedRuntimeTools });
    await this.upsert("agent", "tool_policy", { allowedAgentTools: workspace.allowedAgentTools, deniedRuntimeTools: workspace.deniedRuntimeTools, policyVersion: "p0" }, boundary.actorId);
    return toToolPolicy(workspace, boundary.actorId);
  }

  private async upsert(namespace: string, settingKey: string, settingJson: Record<string, unknown>, actorId: string): Promise<void> {
    await this.prisma.workspaceSetting.upsert({
      where: { namespace_settingKey: { namespace, settingKey } },
      create: { namespace, settingKey, settingJson, status: "active", updatedBy: actorId },
      update: { settingJson, updatedBy: actorId },
    });
  }
}

export class PrismaReviewRepository extends ReviewRepository {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async list(_boundary: P0AuthContextDto): Promise<ReviewItemDto[]> {
    const rows = await this.prisma.reviewItem.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toReviewItemDto);
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
    return toReviewItemDto(updated);
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

  async list(boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<ReviewItemDto>> {
    const items = await this.repository.list(boundary);
    return { items, page: 1, pageSize: items.length || 20, total: items.length };
  }

  async create(items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReviewItemDto[]> {
    return this.repository.create(boundary, items);
  }

  async decide(reviewItemId: string, request: ReviewDecisionRequestDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReviewItemDto> {
    return this.repository.decide(boundary, reviewItemId, request);
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
    return this.repository.save(boundary, report);
  }
}

export class RuleSetService {
  constructor(private readonly tx: TransactionManager, private readonly auditRepository: IngestRepository, private readonly repository: RuleSetRepository) {}

  list(page?: number, pageSize?: number, boundary: P0AuthContextDto = explicitDevBoundary): Promise<PageDto<RuleSetListItemDto>> {
    return Promise.resolve(this.repository.list(boundary, page, pageSize));
  }

  async get(ruleSetId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<RuleSetDetailDto | null> {
    return this.repository.getDetail(boundary, ruleSetId);
  }

  async create(input: CreateRuleSetInputDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<RuleSetDetailDto> {
    return this.tx.transaction(async (tx) => {
      const detail = await this.repository.create(boundary, input);
      await this.auditRepository.recordWorkflowAudit(tx, boundary, {
        workflowType: "rule_set_create",
        subjectType: "rule_set",
        subjectId: detail.ruleSetId,
        input: { name: input.name, type: detail.type, actorId: boundary.actorId },
        output: { ruleSetId: detail.ruleSetId, status: detail.status, version: detail.version },
      });
      return detail;
    });
  }

  async update(ruleSetId: string, input: UpdateRuleSetInputDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<RuleSetDetailDto> {
    return this.tx.transaction(async (tx) => {
      const detail = await this.repository.update(boundary, ruleSetId, input);
      await this.auditRepository.recordWorkflowAudit(tx, boundary, {
        workflowType: "rule_set_update",
        subjectType: "rule_set",
        subjectId: ruleSetId,
        input: { ruleSetId, fields: Object.keys(input), actorId: boundary.actorId },
        output: { ruleSetId, status: detail.status, version: detail.version },
      });
      return detail;
    });
  }

  async createVersion(ruleSetId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<RuleSetVersionDto> {
    return this.tx.transaction(async (tx) => {
      const version = await this.repository.createVersion(boundary, ruleSetId);
      await this.auditRepository.recordWorkflowAudit(tx, boundary, {
        workflowType: "rule_set_version_create",
        subjectType: "rule_set",
        subjectId: ruleSetId,
        input: { ruleSetId, actorId: boundary.actorId },
        output: { ruleSetVersionId: version.ruleSetVersionId, version: version.version },
      });
      return version;
    });
  }

  listVersions(ruleSetId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<RuleSetVersionDto[]> {
    return Promise.resolve(this.repository.listVersions(boundary, ruleSetId));
  }

  async setStatus(ruleSetId: string, status: RuleSetStatusDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<RuleSetDetailDto> {
    return this.tx.transaction(async (tx) => {
      const detail = await this.repository.setStatus(boundary, ruleSetId, status);
      await this.auditRepository.recordWorkflowAudit(tx, boundary, {
        workflowType: "rule_set_status_update",
        subjectType: "rule_set",
        subjectId: ruleSetId,
        input: { ruleSetId, status, actorId: boundary.actorId },
        output: { ruleSetId, status: detail.status },
      });
      return detail;
    });
  }
}

export class WorkspaceSettingsService {
  constructor(private readonly tx: TransactionManager, private readonly auditRepository: IngestRepository, private readonly repository: WorkspaceSettingsRepository) {}

  getWorkspace(boundary: P0AuthContextDto = explicitDevBoundary): Promise<WorkspaceSettingsDto> {
    return Promise.resolve(this.repository.getWorkspace(boundary));
  }

  async updateWorkspace(input: Partial<WorkspaceSettingsDto>, boundary: P0AuthContextDto = explicitDevBoundary): Promise<WorkspaceSettingsDto> {
    return this.tx.transaction(async (tx) => {
      const settings = await this.repository.updateWorkspace(boundary, input);
      await this.auditRepository.recordWorkflowAudit(tx, boundary, {
        workflowType: "workspace_settings_update",
        subjectType: "workspace_setting",
        input: { fields: Object.keys(input), actorId: boundary.actorId },
        output: { workspaceId: settings.workspaceId, dataFreshnessThresholdHours: settings.dataFreshnessThresholdHours },
      });
      return settings;
    });
  }

  getToolPolicy(boundary: P0AuthContextDto = explicitDevBoundary): Promise<ToolPolicyDto> {
    return Promise.resolve(this.repository.getToolPolicy(boundary));
  }

  async updateToolPolicy(input: Partial<ToolPolicyDto>, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ToolPolicyDto> {
    return this.tx.transaction(async (tx) => {
      const policy = await this.repository.updateToolPolicy(boundary, input);
      await this.auditRepository.recordWorkflowAudit(tx, boundary, {
        workflowType: "tool_policy_update",
        subjectType: "workspace_setting",
        input: { allowedAgentTools: policy.allowedAgentTools, deniedRuntimeTools: policy.deniedRuntimeTools, actorId: boundary.actorId },
        output: { policyVersion: policy.policyVersion, deniedRuntimeTools: policy.deniedRuntimeTools },
      });
      return policy;
    });
  }

  listUsers(boundary: P0AuthContextDto = explicitDevBoundary): Promise<SettingsUserDto[]> {
    return Promise.resolve(this.repository.listUsers(boundary));
  }
}

const forcedDeniedRuntimeTools = ["coding", "file", "bash", "shell", "terminal", "runtime:exec", "prisma:migrate"];

function defaultRuleSetMetadata(): RuleSetMetadata {
  return { type: "ACTIVITY_RULE", source: "INTERNAL", status: "DRAFT", version: "v1", updatedAt: new Date(0).toISOString(), updatedBy: "system" };
}

function assembleRuleSetDetail(item: RuleSetListItemDto, ruleSet: ActivityRuleSetDto, relatedRuns: TraceableRefDto[]): RuleSetDetailDto {
  return {
    ...item,
    summary: {
      ruleCount: ruleSet.rules.length,
      validationMode: ruleSet.rules.some((rule) => rule.severity === "blocking") ? "BLOCK_AND_HINT" : "HINT_ONLY",
      failureHandling: ruleSet.rules.some((rule) => rule.type === "manual_review") ? "MANUAL_REVIEW" : ruleSet.rules.some((rule) => rule.severity === "blocking") ? "BLOCK" : "WARN",
      priority: ruleSet.rules.some((rule) => rule.severity === "blocking") ? "P0" : "P1",
      scopeText: ruleSet.platform ? `平台 ${ruleSet.platform}` : "全工作区",
      linkedDataSources: [...new Set(extractAffectedFields(ruleSet.rules).flatMap((item) => item.dataSources.map((source) => source.label)))],
    },
    dslJson: ruleSet.rules,
    affectedFields: extractAffectedFields(ruleSet.rules),
    manualReviewItems: extractManualReviewItems(ruleSet.rules),
    relatedRuns,
  };
}

function extractAffectedFields(rules: CanonicalRuleDto[]): RuleSetDetailDto["affectedFields"] {
  const fields = new Map<string, RuleSetDetailDto["affectedFields"][number]>();
  for (const rule of rules) {
    for (const field of [rule.field, rule.compareField].filter((value): value is string => Boolean(value))) {
      fields.set(field, {
        field,
        label: fieldLabel(field),
        required: rule.type === "data_required" || rule.severity === "blocking",
        dataSources: [{ entityType: "connector", entityId: `connector_${field}`, label: fieldDataSource(field), drawerTarget: "connector" }],
      });
    }
  }
  return Array.from(fields.values());
}

function extractManualReviewItems(rules: CanonicalRuleDto[]): RuleSetDetailDto["manualReviewItems"] {
  return rules
    .filter((rule) => rule.type === "manual_review")
    .map((rule) => ({ reasonCode: rule.id, question: rule.message, confidence: rule.severity === "warning" ? 0.72 : 0.9 }));
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = { stock: "库存", positiveRate: "好评率", certificateStatus: "证书状态", campaignPrice: "活动价", sales30d: "30 天销量" };
  return labels[field] ?? field;
}

function fieldDataSource(field: string): string {
  if (field === "certificateStatus") return "资质/证书数据源";
  if (field === "positiveRate") return "评价数据源";
  return "商品数据源";
}

function defaultWorkspaceSettings(): WorkspaceSettingsDto {
  return normalizeWorkspaceSettings({
    workspaceId: "default_workspace",
    name: "PickAgent 工作区",
    defaultTenantId: "dev_tenant",
    dataFreshnessThresholdHours: 24,
    reviewSlaHours: { high: 4, medium: 24, low: 72 },
    allowedAgentTools: ["getSkuSummary", "parseActivityRules", "simulateActivityReadiness", "runSimulation", "checkDataFreshness", "diagnoseSkuHealth", "createReviewItems", "explainDecisionWithEvidence", "generateReportPreview"],
    deniedRuntimeTools: forcedDeniedRuntimeTools,
  });
}

function normalizeWorkspaceSettings(input: Partial<WorkspaceSettingsDto>): WorkspaceSettingsDto {
  const defaults = {
    workspaceId: "default_workspace",
    name: "PickAgent 工作区",
    defaultTenantId: "dev_tenant",
    dataFreshnessThresholdHours: 24,
    reviewSlaHours: { high: 4, medium: 24, low: 72 },
    allowedAgentTools: [] as string[],
    deniedRuntimeTools: [] as string[],
  };
  const deniedRuntimeTools = Array.from(new Set([...(input.deniedRuntimeTools ?? defaults.deniedRuntimeTools), ...forcedDeniedRuntimeTools]));
  return {
    ...defaults,
    ...input,
    reviewSlaHours: { ...defaults.reviewSlaHours, ...input.reviewSlaHours },
    allowedAgentTools: (input.allowedAgentTools ?? defaults.allowedAgentTools).filter((tool) => !forcedDeniedRuntimeTools.includes(tool)),
    deniedRuntimeTools,
  };
}

function toToolPolicy(settings: WorkspaceSettingsDto, updatedBy: string, updatedAt = new Date().toISOString()): ToolPolicyDto {
  return { allowedAgentTools: settings.allowedAgentTools, deniedRuntimeTools: settings.deniedRuntimeTools, policyVersion: "p0", updatedAt, updatedBy };
}

function defaultSettingsUsers(): SettingsUserDto[] {
  return [
    { userId: "ops_lead", name: "运营负责人", role: "op_team", teamName: "运营团队", status: "ACTIVE" },
    { userId: "qa_reviewer", name: "质检复核", role: "qa_team", teamName: "质检团队", status: "ACTIVE" },
    { userId: "compliance_owner", name: "合规审批", role: "compliance_team", teamName: "合规团队", status: "ACTIVE" },
  ];
}

function toRuleSetDto(row: Record<string, unknown>): ActivityRuleSetDto {
  return {
    ruleSetId: String(row.id),
    name: String(row.name),
    platform: typeof row.platform === "string" ? row.platform : undefined,
    sourceText: String(row.sourceText),
    rules: asArray(row.rulesJson) as CanonicalRuleDto[],
    parseStatus: String(row.parseStatus).toUpperCase() as ActivityRuleSetDto["parseStatus"],
    confidence: Number(row.parseConfidence ?? 0),
    errors: asArray(asRecord(row.parseMetadataJson).errors).map(String),
  };
}

function toRuleSetVersionDto(row: Record<string, unknown>): RuleSetVersionDto {
  return {
    ruleSetVersionId: String(row.id),
    ruleSetId: String(row.ruleSetId),
    version: `v${Number(row.version ?? 1)}`,
    status: statusFromString(row.status),
    sourceText: String(row.sourceText),
    dslJson: asArray(row.rulesJson) as CanonicalRuleDto[],
    affectedFields: asArray(row.requiredFieldsJson) as RuleSetVersionDto["affectedFields"],
    manualReviewItems: asArray(row.confirmationsJson) as RuleSetVersionDto["manualReviewItems"],
    createdAt: dateString(row.createdAt),
    createdBy: String(row.createdBy ?? asRecord(row.metadataJson).createdBy ?? "system"),
  };
}

function settingsRowsToWorkspace(rows: Record<string, unknown>[]): Partial<WorkspaceSettingsDto> {
  const workspace = defaultWorkspaceSettings();
  for (const row of rows) {
    const key = String(row.settingKey);
    const value = asRecord(row.settingJson);
    if (key === "freshness_thresholds") workspace.dataFreshnessThresholdHours = Number(value.dataFreshnessThresholdHours ?? value.hours ?? workspace.dataFreshnessThresholdHours);
    if (key === "review_sla") workspace.reviewSlaHours = { ...workspace.reviewSlaHours, ...value };
    if (key === "tool_policy") {
      workspace.allowedAgentTools = asArray(value.allowedAgentTools).map(String);
      workspace.deniedRuntimeTools = asArray(value.deniedRuntimeTools).map(String);
    }
  }
  return workspace;
}

function ruleSetTypeFromMetadata(value: unknown): RuleSetTypeDto {
  const type = asRecord(value).type;
  return type === "QUALIFICATION_RULE" || type === "CONTENT_RULE" ? type : "ACTIVITY_RULE";
}

function ruleSetSourceFromMetadata(value: unknown): RuleSetSourceDto {
  return asRecord(value).source === "PLATFORM" ? "PLATFORM" : "INTERNAL";
}

function ruleSetStatusFromMetadata(value: unknown): RuleSetStatusDto {
  return statusFromString(asRecord(value).status);
}

function statusFromString(value: unknown): RuleSetStatusDto {
  const upper = String(value ?? "DRAFT").toUpperCase();
  return upper === "ENABLED" || upper === "DISABLED" ? upper : "DRAFT";
}

function dateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value ? value : new Date().toISOString();
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

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
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
    const ruleSetService = new RuleSetService(tx, new PrismaIngestRepository(), new PrismaRuleSetRepository(options.prisma));
    const workspaceSettingsService = new WorkspaceSettingsService(tx, new PrismaIngestRepository(), new PrismaWorkspaceSettingsRepository(options.prisma));
    return { adapter, store: memoryStore, tx, ingestService, activityService, reviewService, reportService, ruleSetService, workspaceSettingsService };
  }
  const store = new FinalApiPersistenceStore();
  const tx = new InMemoryTransactionManager(store);
  const skuQueryRepository = new SkuQueryRepository(store);
  const ingestService = new FinalIngestService(tx, new IngestRepository(), skuQueryRepository);
  const activityService = new FinalActivityService(new ActivityRepository(store), skuQueryRepository);
  const reviewService = new FinalReviewService(new ReviewRepository(store));
  const reportService = new FinalReportService(new ReportRepository(store), skuQueryRepository);
  const auditRepository = new IngestRepository();
  const ruleSetService = new RuleSetService(tx, auditRepository, new RuleSetRepository(store));
  const workspaceSettingsService = new WorkspaceSettingsService(tx, auditRepository, new WorkspaceSettingsRepository(store));
  return { adapter, store, tx, ingestService, activityService, reviewService, reportService, ruleSetService, workspaceSettingsService };
}
