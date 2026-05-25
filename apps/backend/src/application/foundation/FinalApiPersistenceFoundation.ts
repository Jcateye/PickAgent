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
  defaultAgentToolNames,
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
  ReportComparisonDto,
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
import type {
  BrowserPageDetectionDto,
  BrowserPageDetectionRequestDto,
  BrowserScanPreviewDto,
  BrowserScanPreviewRequestDto,
  ConnectorDetailDto,
  ConnectorListItemDto,
  ConnectorRunDetailDto,
  ConnectorRunSummaryDto,
  CreateConnectorDto,
  CreateConnectorSyncRunDto,
  PageDto as ConnectorPageDto,
  TraceableRef as ConnectorTraceableRef,
  UpdateConnectorDto,
} from "../../../../contracts/types/connectorBackend";
import { HealthAssessmentService, NormalizationService } from "./BusinessFoundationServices";
import { assertTenantBoundary, redactSensitiveValue, type P0AuthContextDto } from "./P0AuthBoundaryRuntimeConfig";

declare const process: { env: Record<string, string | undefined> };

export interface ApiEnvelope<T> {
  code: "OK" | string;
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
  nextActionOverride?: DashboardSkuListItemDto["nextAction"];
  updatedAt: string;
}

export interface UpdateSkuNextActionInputDto {
  nextAction: DashboardSkuListItemDto["nextAction"];
  comment?: string;
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
  status?: RuleSetStatusDto;
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

export interface WorkflowAuditRecord {
  workflowRunId: string;
  workflowType: string;
  status: string;
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
  findFirst(args?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
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
  ruleSetVersion: PrismaDelegate;
  activitySimulationRun: PrismaDelegate;
  activitySimulationResult: PrismaDelegate;
  reviewItem: PrismaDelegate;
  workflowRun: PrismaDelegate;
  workflowStep: PrismaDelegate;
  report?: PrismaDelegate;
  reportVersion?: PrismaDelegate;
  connector: PrismaDelegate;
  connectorRun: PrismaDelegate;
  workspaceSetting: PrismaDelegate;
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
  readonly ruleSetVersions = new Map<string, RuleSetVersionDto>();
  readonly ruleSetMetadata = new Map<string, RuleSetMetadata>();
  readonly simulationRuns = new Map<string, ActivitySimulationRunDto>();
  readonly simulationResults = new Map<string, SimulationResultDto>();
  readonly reviews = new Map<string, ReviewItemDto>();
  readonly reports = new Map<string, ReportPreviewDto>();
  readonly reportDetails = new Map<string, ReportDetailDto>();
  readonly reportVersions = new Map<string, ReportVersionDto[]>();
  readonly reportExports = new Map<string, ReportExportJobDto>();
  readonly reportSubscriptions = new Map<string, ReportSubscriptionDto>();
  readonly connectors = new Map<string, ConnectorRecordDto>();
  readonly connectorRuns = new Map<string, ConnectorRunRecordDto>();
  readonly workflowAudits = new Map<string, WorkflowAuditRecord>();
  readonly skuNextActionOverrides = new Map<string, DashboardSkuListItemDto["nextAction"]>();
  readonly tenantByEntityId = new Map<string, string>();
}

interface ConnectorRecordDto {
  connectorId: string;
  code: string;
  name: string;
  kind: string;
  platform?: string;
  config: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectorRunRecordDto {
  connectorRunId: string;
  connectorId: string;
  workflowRunId?: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  rowCount: number;
  qualityScore?: number;
  warnings: string[];
  summary: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
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

  async updateNextAction(boundary: P0AuthContextDto, skuProfileId: string, input: UpdateSkuNextActionInputDto): Promise<DashboardSkuReadModelRecord> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(skuProfileId), skuProfileId);
    const summary = this.store.projections.get(skuProfileId);
    if (!summary) throw new Error("SKU not found");
    this.store.skuNextActionOverrides.set(skuProfileId, input.nextAction);
    return this.toRecord(summary);
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
      nextActionOverride: this.store.skuNextActionOverrides.get(summary.skuProfileId),
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

  listRecentSimulationRuns(_boundary: P0AuthContextDto, limit = 20): ActivitySimulationRunDto[] | Promise<ActivitySimulationRunDto[]> {
    return Array.from(this.store.simulationRuns.values())
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .slice(0, limit);
  }

  recordWorkflowAudit(boundary: P0AuthContextDto, workflowType: string, subjectId: string, input: Record<string, unknown>, output: Record<string, unknown>): TraceableRef | Promise<TraceableRef> {
    const workflowRunId = nextId("workflow");
    this.store.workflowAudits.set(workflowRunId, { workflowRunId, workflowType, status: "SUCCEEDED", subjectType: "activity", subjectId, input, output, createdAt: new Date().toISOString() });
    this.store.tenantByEntityId.set(workflowRunId, boundary.tenantId);
    return traceRef("workflow_run", workflowRunId, "Workflow audit");
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
      ruleSetId: nextUuid(),
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
      rules: input.sourceText !== undefined ? deterministicRules(input.sourceText) : input.rules ?? current.rules,
    };
    assertValidRuleSet(updated);
    this.store.ruleSets.set(ruleSetId, updated);
    this.store.ruleSetMetadata.set(ruleSetId, { ...this.metadata(ruleSetId), status: input.status ?? this.metadata(ruleSetId).status, updatedAt: new Date().toISOString(), updatedBy: boundary.actorId });
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
    const detail = this.store.reportDetails.get(reportId);
    if (!detail) return null;
    const subscription = this.store.reportSubscriptions.get(reportId);
    return subscription ? { ...detail, subscription } : detail;
  }

  listVersions(boundary: P0AuthContextDto, reportId: string): ReportVersionDto[] | Promise<ReportVersionDto[]> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    return this.store.reportVersions.get(reportId) ?? [];
  }

  getVersion(boundary: P0AuthContextDto, reportId: string, versionId: string): ReportVersionDto | null | Promise<ReportVersionDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    return (this.store.reportVersions.get(reportId) ?? []).find((item) => item.versionId === versionId) ?? null;
  }

  getExportStatus(boundary: P0AuthContextDto, reportId: string): ReportListItemDto["exportStatus"] | Promise<ReportListItemDto["exportStatus"]> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    const exports = Array.from(this.store.reportExports.values())
      .filter((job) => job.reportId === reportId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
    return exports[0]?.status ?? "NONE";
  }

  createExport(boundary: P0AuthContextDto, reportId: string, request: ReportExportRequestDto): ReportExportJobDto | Promise<ReportExportJobDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    const key = request.idempotencyKey ? `${reportId}:${request.idempotencyKey}` : "";
    const existing = key ? this.store.reportExports.get(key) : undefined;
    if (existing) return existing;
    const job: ReportExportJobDto = { exportJobId: nextId("export"), reportId, status: "PENDING", format: request.format, includeCharts: request.includeCharts ?? true, includeDetails: request.includeDetails ?? false, requestedAt: new Date().toISOString() };
    this.store.reportExports.set(key || job.exportJobId, job);
    const audit: WorkflowAuditRecord = {
      workflowRunId: nextId("workflow"),
      workflowType: "report_export",
      status: "SUCCEEDED",
      subjectType: "report",
      subjectId: reportId,
      input: { actorId: boundary.actorId, request },
      output: { exportJobId: job.exportJobId, status: job.status, format: job.format },
      createdAt: job.requestedAt,
    };
    this.store.workflowAudits.set(audit.workflowRunId, audit);
    this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return job;
  }

  saveSubscription(boundary: P0AuthContextDto, reportId: string, request: ReportSubscriptionRequestDto): ReportSubscriptionDto | Promise<ReportSubscriptionDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(reportId), reportId);
    const subscription = { ...request, reportId, updatedAt: new Date().toISOString() };
    this.store.reportSubscriptions.set(reportId, subscription);
    const audit: WorkflowAuditRecord = {
      workflowRunId: nextId("workflow"),
      workflowType: "report_subscription",
      status: "SUCCEEDED",
      subjectType: "report",
      subjectId: reportId,
      input: { actorId: boundary.actorId, request },
      output: { reportId, frequency: subscription.frequency, recipients: subscription.recipients },
      createdAt: subscription.updatedAt,
    };
    this.store.workflowAudits.set(audit.workflowRunId, audit);
    this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return subscription;
  }

  getSimulationResult(boundary: P0AuthContextDto, id: string): SimulationResultDto | null | Promise<SimulationResultDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(id), id);
    return this.store.simulationResults.get(id) ?? null;
  }
}

export class ConnectorRepositoryV2 {
  constructor(private readonly store: FinalApiPersistenceStore) {}

  list(boundary: P0AuthContextDto, page = 1, pageSize = 20): ConnectorPageDto<ConnectorListItemDto> | Promise<ConnectorPageDto<ConnectorListItemDto>> {
    const records = Array.from(this.store.connectors.values())
      .filter((item) => this.store.tenantByEntityId.get(item.connectorId) === boundary.tenantId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const start = (page - 1) * pageSize;
    return { items: records.slice(start, start + pageSize).map((item) => this.toMemoryListItem(item)), page, pageSize, total: records.length };
  }

  get(boundary: P0AuthContextDto, connectorId: string): ConnectorDetailDto | null | Promise<ConnectorDetailDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(connectorId), connectorId);
    const connector = this.store.connectors.get(connectorId);
    if (!connector) return null;
    const recentRuns = this.runsForConnector(connectorId).slice(0, 5).map(toConnectorRunSummary);
    return { ...this.toMemoryListItem(connector), config: connector.config, permissions: permissionsFromConfig(connector.config), recentRuns };
  }

  create(boundary: P0AuthContextDto, input: CreateConnectorDto): ConnectorDetailDto | Promise<ConnectorDetailDto> {
    const now = new Date().toISOString();
    const connector: ConnectorRecordDto = {
      connectorId: nextId("connector"),
      code: input.code,
      name: input.name,
      kind: input.kind,
      platform: input.platform,
      config: sanitizeConnectorConfig(input.config ?? {}),
      status: normalizeConnectorStatus(input.status),
      createdAt: now,
      updatedAt: now,
    };
    this.store.connectors.set(connector.connectorId, connector);
    this.store.tenantByEntityId.set(connector.connectorId, boundary.tenantId);
    return { ...this.toMemoryListItem(connector), config: connector.config, permissions: permissionsFromConfig(connector.config), recentRuns: [] };
  }

  update(boundary: P0AuthContextDto, connectorId: string, input: UpdateConnectorDto): ConnectorDetailDto | Promise<ConnectorDetailDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(connectorId), connectorId);
    const current = this.store.connectors.get(connectorId);
    if (!current) throw new Error(`Connector not found: ${connectorId}`);
    const updated: ConnectorRecordDto = {
      ...current,
      name: input.name ?? current.name,
      platform: input.platform === null ? undefined : input.platform ?? current.platform,
      config: input.config ? sanitizeConnectorConfig(input.config) : current.config,
      status: input.status ? normalizeConnectorStatus(input.status) : current.status,
      updatedAt: new Date().toISOString(),
    };
    this.store.connectors.set(connectorId, updated);
    const recentRuns = this.runsForConnector(connectorId).slice(0, 5).map(toConnectorRunSummary);
    return { ...this.toMemoryListItem(updated), config: updated.config, permissions: permissionsFromConfig(updated.config), recentRuns };
  }

  createRun(boundary: P0AuthContextDto, connectorId: string, input: CreateConnectorSyncRunDto): ConnectorRunDetailDto | Promise<ConnectorRunDetailDto> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(connectorId), connectorId);
    const connector = this.store.connectors.get(connectorId);
    if (!connector) throw new Error(`Connector not found: ${connectorId}`);
    const now = new Date().toISOString();
    const run: ConnectorRunRecordDto = {
      connectorRunId: nextId("connector_run"),
      connectorId,
      status: "SUCCEEDED",
      rowCount: input.rowCount ?? 0,
      qualityScore: normalizeConnectorQualityScore(input.qualityScore),
      warnings: input.warnings ?? [],
      summary: input.summary ?? {},
      startedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const audit: WorkflowAuditRecord = {
      workflowRunId: nextId("workflow"),
      workflowType: "connector_sync",
      status: "SUCCEEDED",
      subjectType: "connector",
      subjectId: connectorId,
      input: { connectorId, actorId: boundary.actorId, tenantId: boundary.tenantId, surface: boundary.surface },
      output: { connectorRunId: run.connectorRunId, rowCount: run.rowCount, qualityScore: run.qualityScore },
      createdAt: now,
    };
    run.workflowRunId = audit.workflowRunId;
    this.store.workflowAudits.set(audit.workflowRunId, audit);
    this.store.connectorRuns.set(run.connectorRunId, run);
    this.store.tenantByEntityId.set(run.connectorRunId, boundary.tenantId);
    this.store.tenantByEntityId.set(audit.workflowRunId, boundary.tenantId);
    return toConnectorRunDetail(run, connector);
  }

  listRuns(boundary: P0AuthContextDto, connectorId: string, page = 1, pageSize = 20): ConnectorPageDto<ConnectorRunSummaryDto> | Promise<ConnectorPageDto<ConnectorRunSummaryDto>> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(connectorId), connectorId);
    const records = this.runsForConnector(connectorId);
    const start = (page - 1) * pageSize;
    return { items: records.slice(start, start + pageSize).map(toConnectorRunSummary), page, pageSize, total: records.length };
  }

  getRun(boundary: P0AuthContextDto, connectorRunId: string): ConnectorRunDetailDto | null | Promise<ConnectorRunDetailDto | null> {
    assertTenantBoundary(boundary, this.store.tenantByEntityId.get(connectorRunId), connectorRunId);
    const run = this.store.connectorRuns.get(connectorRunId);
    if (!run) return null;
    const connector = this.store.connectors.get(run.connectorId);
    if (!connector) return null;
    return toConnectorRunDetail(run, connector);
  }

  private runsForConnector(connectorId: string): ConnectorRunRecordDto[] {
    return Array.from(this.store.connectorRuns.values()).filter((item) => item.connectorId === connectorId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private toMemoryListItem(record: ConnectorRecordDto): ConnectorListItemDto {
    const latestRun = this.runsForConnector(record.connectorId)[0];
    return {
      connectorId: record.connectorId,
      code: record.code,
      name: record.name,
      kind: record.kind,
      platform: record.platform,
      status: normalizeConnectorStatus(record.status),
      permissionSummary: permissionSummary(record.config),
      configSummary: connectorConfigSummary(record.config),
      latestRun: latestRun ? toConnectorRunSummary(latestRun) : undefined,
      traceRef: connectorTraceRef("connector", record.connectorId, record.name),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export class BrowserConnectorService {
  detectPage(input: BrowserPageDetectionRequestDto): BrowserPageDetectionDto {
    const url = input.url.toLowerCase();
    const sample = `${input.title ?? ""} ${input.htmlTextSample ?? ""}`.toLowerCase();
    const platform = url.includes("tmall") || sample.includes("tmall") || sample.includes("天猫") ? "tmall" : url.includes("douyin") || sample.includes("抖音") ? "douyin" : undefined;
    const pageType = /sku|item|商品|product/.test(`${url} ${sample}`) ? "SKU_LIST" : "UNKNOWN";
    const supported = Boolean(platform) && pageType !== "UNKNOWN";
    return {
      supported,
      pageType,
      platform,
      confidence: supported ? 0.82 : 0.35,
      reason: supported ? "识别为可采集商品页面，scan preview 仍只返回预览不写业务真相" : "未识别到受支持的平台商品结构",
      traceRef: connectorTraceRef("connector", "browser-page-detection", "浏览器页面识别"),
    };
  }

  scanPreview(input: BrowserScanPreviewRequestDto): BrowserScanPreviewDto {
    const detected = this.detectPage({ url: input.url, htmlTextSample: JSON.stringify(input.rows.slice(0, 2)) });
    const rowCount = input.rows.length;
    const fieldMappings = inferFieldMappings(input.rows);
    const warnings = [
      ...(rowCount === 0 ? ["未扫描到可提交行"] : []),
      ...(detected.supported ? [] : ["页面类型未确认，需人工确认字段映射"]),
      ...(fieldMappings.some((item) => item.confidence < 0.7) ? ["存在低置信度字段映射"] : []),
    ];
    const qualityScore = Math.max(0, Math.min(100, Math.round((detected.confidence * 50) + Math.min(fieldMappings.length, 6) * 8 - warnings.length * 8)));
    return {
      connectorId: input.connectorId,
      detected,
      rowCount,
      qualityScore,
      warnings,
      fieldMappings,
      sampleRows: input.rows.slice(0, 5).map((row) => redactSensitiveValue(row) as Record<string, unknown>),
      ingestReady: rowCount > 0 && warnings.length === 0,
      traceRefs: [detected.traceRef],
    };
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

  async updateNextAction(_boundary: P0AuthContextDto, skuProfileId: string, input: UpdateSkuNextActionInputDto): Promise<DashboardSkuReadModelRecord> {
    const row = await this.prisma.currentSkuProjection.findUnique({
      where: { skuProfileId },
      include: { skuProfile: true, latestSnapshot: true, latestDiagnosis: true },
    });
    if (!row) throw new Error("SKU not found");
    await this.prisma.workflowRun.create({
      data: {
        id: nextUuid(),
        workflowType: "sku_next_action_update",
        status: "SUCCEEDED",
        subjectType: "sku_profile",
        subjectId: skuProfileId,
        inputJson: input,
        outputJson: { skuProfileId, nextAction: input.nextAction },
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return this.toRecordFromProjection(row, input.nextAction);
  }

  private async toRecordFromProjection(row: Record<string, unknown>, nextActionOverride?: DashboardSkuListItemDto["nextAction"]): Promise<DashboardSkuReadModelRecord> {
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
    const nextActionRun = await this.prisma.workflowRun.findFirst({
      where: { workflowType: "sku_next_action_update", subjectType: "sku_profile", subjectId: summary.skuProfileId },
      orderBy: { startedAt: "desc" },
    });
    return {
      summary,
      latestSnapshot,
      latestDiagnosis,
      latestSimulationResult: simulationRows[0] ? toSimulationResultDto(simulationRows[0]) : null,
      relatedReviews: reviewRows.map(toReviewItemDto),
      nextActionOverride: nextActionOverride ?? nextActionFromWorkflowRun(nextActionRun),
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

  async listRecentSimulationRuns(boundary: P0AuthContextDto, limit = 20): Promise<ActivitySimulationRunDto[]> {
    const rows = await this.prisma.activitySimulationRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
    const runs = await Promise.all(rows.map((row) => this.getSimulationRun(boundary, String(row.id))));
    return runs.filter((run): run is ActivitySimulationRunDto => run !== null);
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
    const rules = input.sourceText !== undefined ? deterministicRules(input.sourceText) : input.rules ?? (asArray(current.rulesJson) as CanonicalRuleDto[]);
    const row = await this.prisma.activityRuleSet.update({
      where: { id: ruleSetId },
      data: {
        name: input.name,
        platform: input.platform,
        sourceText: input.sourceText,
        rulesJson: rules,
        parseMetadataJson: { ...asRecord(current.parseMetadataJson), status: input.status ?? ruleSetStatusFromMetadata(current.parseMetadataJson), updatedBy: boundary.actorId },
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
    await this.upsert("agent", "tool_policy", { allowedAgentTools: next.allowedAgentTools, deniedRuntimeTools: next.deniedRuntimeTools, policyVersion: toolPolicyVersion }, boundary.actorId);
    return next;
  }

  async getToolPolicy(boundary: P0AuthContextDto): Promise<ToolPolicyDto> {
    const row = (await this.prisma.workspaceSetting.findMany({ where: { namespace: "agent", settingKey: "tool_policy" }, take: 1 }))[0];
    const workspace = migrateToolPolicyWorkspace(asRecord(row?.settingJson));
    return toToolPolicy(workspace, boundary.actorId, dateString(row?.updatedAt));
  }

  async updateToolPolicy(boundary: P0AuthContextDto, input: Partial<ToolPolicyDto>): Promise<ToolPolicyDto> {
    const workspace = normalizeWorkspaceSettings({ ...defaultWorkspaceSettings(), allowedAgentTools: input.allowedAgentTools, deniedRuntimeTools: input.deniedRuntimeTools });
    await this.upsert("agent", "tool_policy", { allowedAgentTools: workspace.allowedAgentTools, deniedRuntimeTools: workspace.deniedRuntimeTools, policyVersion: toolPolicyVersion }, boundary.actorId);
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

  async create(boundary: P0AuthContextDto, items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): Promise<ReviewItemDto[]> {
    const created: ReviewItemDto[] = [];
    for (const item of items) {
      const id = nextUuid();
      const row = await this.prisma.reviewItem.create({
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
      await this.prisma.workflowRun.create({
        data: {
          id: nextUuid(),
          workflowType: "review_create",
          status: "SUCCEEDED",
          subjectType: "review_item",
          subjectId: id,
          inputJson: { actorId: boundary.actorId, sourceType: item.sourceType, sourceId: item.sourceId },
          outputJson: { reviewItemId: id, status: "OPEN" },
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
      created.push(toReviewItemDto(row));
    }
    return created;
  }

  async getById(_boundary: P0AuthContextDto, reviewItemId: string): Promise<ReviewItemDto | null> {
    const row = await this.prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
    return row ? toReviewItemDto(row) : null;
  }

  async update(boundary: P0AuthContextDto, reviewItemId: string, patch: Partial<Pick<ReviewItemDto, "question" | "recommendation" | "riskLevel">>): Promise<ReviewItemDto> {
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
        inputJson: { actorId: boundary.actorId, patch },
        outputJson: { reviewItemId },
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return toReviewItemDto(updated);
  }

  async decide(boundary: P0AuthContextDto, reviewItemId: string, request: ReviewDecisionRequestDto): Promise<ReviewItemDto> {
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
        inputJson: { actorId: boundary.actorId, decision: request.decision, decisionBy: request.decisionBy, modifiedPayload: request.modifiedPayload },
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
        id: nextUuid(),
        workflowType: "report_preview",
        status: "SUCCEEDED",
        subjectType: report.type,
        subjectId: report.reportId,
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
    return Promise.all(rows.map((row) => this.toDetailFromReportRow(row)));
  }

  async getById(_boundary: P0AuthContextDto, reportId: string): Promise<ReportDetailDto | null> {
    if (!this.prisma.report) return null;
    const row = await this.prisma.report.findUnique({ where: { id: reportId } });
    return row ? this.toDetailFromReportRow(row) : null;
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

  async getExportStatus(_boundary: P0AuthContextDto, reportId: string): Promise<ReportListItemDto["exportStatus"]> {
    if (!this.prisma.report) return "NONE";
    const row = await this.prisma.report.findUnique({ where: { id: reportId } });
    const status = String((row as Record<string, unknown> | null)?.exportStatus ?? "NONE");
    if (status === "PENDING" || status === "READY" || status === "FAILED") return status;
    return "NONE";
  }

  async createExport(boundary: P0AuthContextDto, reportId: string, request: ReportExportRequestDto): Promise<ReportExportJobDto> {
    if (this.prisma.report) {
      await this.prisma.report.update({ where: { id: reportId }, data: { exportStatus: "PENDING" } });
    }
    const job = { exportJobId: request.idempotencyKey ?? nextUuid(), reportId, status: "PENDING" as const, format: request.format, includeCharts: request.includeCharts ?? true, includeDetails: request.includeDetails ?? false, requestedAt: new Date().toISOString() };
    await this.prisma.workflowRun.create({
      data: {
        id: nextUuid(),
        workflowType: "report_export",
        status: "SUCCEEDED",
        subjectType: "report",
        subjectId: reportId,
        inputJson: { actorId: boundary.actorId, request },
        outputJson: { exportJobId: job.exportJobId, status: job.status, format: job.format },
        startedAt: new Date(job.requestedAt),
        completedAt: new Date(job.requestedAt),
      },
    });
    return job;
  }

  async saveSubscription(boundary: P0AuthContextDto, reportId: string, request: ReportSubscriptionRequestDto): Promise<ReportSubscriptionDto> {
    const subscription = { ...request, reportId, updatedAt: new Date().toISOString() };
    if (this.prisma.report) {
      await this.prisma.report.update({ where: { id: reportId }, data: { subscriptionJson: subscription } });
    }
    await this.prisma.workflowRun.create({
      data: {
        id: nextUuid(),
        workflowType: "report_subscription",
        status: "SUCCEEDED",
        subjectType: "report",
        subjectId: reportId,
        inputJson: { actorId: boundary.actorId, request },
        outputJson: { reportId, frequency: subscription.frequency, recipients: subscription.recipients },
        startedAt: new Date(subscription.updatedAt),
        completedAt: new Date(subscription.updatedAt),
      },
    });
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

  private async toDetailFromReportRow(row: Record<string, unknown>): Promise<ReportDetailDto> {
    const latestVersionId = typeof row.latestVersionId === "string" ? row.latestVersionId : undefined;
    const versionRow = this.prisma.reportVersion
      ? latestVersionId
        ? await this.prisma.reportVersion.findUnique({ where: { id: latestVersionId } })
        : await this.prisma.reportVersion.findFirst({ where: { reportId: String(row.id) }, orderBy: { version: "desc" } })
      : null;
    const detail = versionRow ? toReportVersionFromRow(versionRow) : toReportDetailFromRow(row);
    const subscription = normalizeReportSubscription(row.subscriptionJson, String(row.id));
    return {
      ...detail,
      reportId: String(row.id),
      title: String(row.title ?? detail.title),
      status: toReportStatus(row.status),
      generatedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : detail.generatedAt,
      ...(subscription ? { subscription } : {}),
    };
  }
}

export class PrismaConnectorRepositoryV2 extends ConnectorRepositoryV2 {
  constructor(private readonly prisma: PrismaPersistenceClient) {
    super(new FinalApiPersistenceStore());
  }

  async list(_boundary: P0AuthContextDto, page = 1, pageSize = 20): Promise<ConnectorPageDto<ConnectorListItemDto>> {
    const rows = await this.prisma.connector.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
    const total = await this.prisma.connector.count();
    const items = await Promise.all(rows.map((row) => this.toPrismaListItem(row)));
    return { items, page, pageSize, total };
  }

  async get(_boundary: P0AuthContextDto, connectorId: string): Promise<ConnectorDetailDto | null> {
    const row = await this.prisma.connector.findUnique({ where: { id: connectorId } });
    if (!row) return null;
    const runs = await this.prisma.connectorRun.findMany({ where: { connectorId }, orderBy: { createdAt: "desc" }, take: 5 });
    const record = toConnectorRecord(row);
    return { ...(await this.toPrismaListItem(row)), config: record.config, permissions: permissionsFromConfig(record.config), recentRuns: runs.map((item) => toConnectorRunSummary(toConnectorRunRecord(item))) };
  }

  async create(_boundary: P0AuthContextDto, input: CreateConnectorDto): Promise<ConnectorDetailDto> {
    const created = await this.prisma.connector.create({ data: { code: input.code, name: input.name, kind: input.kind, platform: input.platform, configJson: sanitizeConnectorConfig(input.config ?? {}), status: normalizeConnectorStatus(input.status).toLowerCase() } });
    const record = toConnectorRecord(created);
    return { ...(await this.toPrismaListItem(created)), config: record.config, permissions: permissionsFromConfig(record.config), recentRuns: [] };
  }

  async update(_boundary: P0AuthContextDto, connectorId: string, input: UpdateConnectorDto): Promise<ConnectorDetailDto> {
    const updated = await this.prisma.connector.update({ where: { id: connectorId }, data: { name: input.name, platform: input.platform, configJson: input.config ? sanitizeConnectorConfig(input.config) : undefined, status: input.status ? normalizeConnectorStatus(input.status).toLowerCase() : undefined } });
    const runs = await this.prisma.connectorRun.findMany({ where: { connectorId }, orderBy: { createdAt: "desc" }, take: 5 });
    const record = toConnectorRecord(updated);
    return { ...(await this.toPrismaListItem(updated)), config: record.config, permissions: permissionsFromConfig(record.config), recentRuns: runs.map((item) => toConnectorRunSummary(toConnectorRunRecord(item))) };
  }

  async createRun(boundary: P0AuthContextDto, connectorId: string, input: CreateConnectorSyncRunDto): Promise<ConnectorRunDetailDto> {
    const connector = await this.prisma.connector.findUnique({ where: { id: connectorId } });
    if (!connector) throw new Error(`Connector not found: ${connectorId}`);
    const now = new Date();
    const workflowRunId = nextUuid();
    const qualityScore = normalizeConnectorQualityScore(input.qualityScore);
    await this.prisma.workflowRun.create({ data: { id: workflowRunId, workflowType: "connector_sync", status: "SUCCEEDED", subjectType: "connector", subjectId: connectorId, inputJson: { connectorId, actorId: boundary.actorId, tenantId: boundary.tenantId, surface: boundary.surface }, outputJson: { rowCount: input.rowCount ?? 0, qualityScore }, startedAt: now, completedAt: now } });
    const created = await this.prisma.connectorRun.create({ data: { connectorId, workflowRunId, status: "succeeded", rowCount: input.rowCount ?? 0, qualityScore, warningsJson: input.warnings ?? [], summaryJson: input.summary ?? {}, startedAt: now, completedAt: now } });
    return toConnectorRunDetail(toConnectorRunRecord(created), toConnectorRecord(connector));
  }

  async listRuns(_boundary: P0AuthContextDto, connectorId: string, page = 1, pageSize = 20): Promise<ConnectorPageDto<ConnectorRunSummaryDto>> {
    const rows = await this.prisma.connectorRun.findMany({ where: { connectorId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
    const total = await this.prisma.connectorRun.count({ where: { connectorId } });
    return { items: rows.map((row) => toConnectorRunSummary(toConnectorRunRecord(row))), page, pageSize, total };
  }

  async getRun(_boundary: P0AuthContextDto, connectorRunId: string): Promise<ConnectorRunDetailDto | null> {
    const row = await this.prisma.connectorRun.findUnique({ where: { id: connectorRunId } });
    if (!row) return null;
    const connector = await this.prisma.connector.findUnique({ where: { id: String(row.connectorId) } });
    if (!connector) return null;
    return toConnectorRunDetail(toConnectorRunRecord(row), toConnectorRecord(connector));
  }

  private async toPrismaListItem(row: Record<string, unknown>): Promise<ConnectorListItemDto> {
    const record = toConnectorRecord(row);
    const latestRun = (await this.prisma.connectorRun.findMany({ where: { connectorId: record.connectorId }, orderBy: { createdAt: "desc" }, take: 1 }))[0];
    return {
      connectorId: record.connectorId,
      code: record.code,
      name: record.name,
      kind: record.kind,
      platform: record.platform,
      status: normalizeConnectorStatus(record.status),
      permissionSummary: permissionSummary(record.config),
      configSummary: connectorConfigSummary(record.config),
      latestRun: latestRun ? toConnectorRunSummary(toConnectorRunRecord(latestRun)) : undefined,
      traceRef: connectorTraceRef("connector", record.connectorId, record.name),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export class WorkflowAuditQueryService {
  constructor(private readonly source: { store?: FinalApiPersistenceStore; prisma?: PrismaPersistenceClient }) {}

  async list(_boundary: P0AuthContextDto, limit = 50): Promise<WorkflowAuditRecord[]> {
    if (this.source.prisma) {
      const rows = await this.source.prisma.workflowRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
      return rows.map((row) => ({
        workflowRunId: String(row.id),
        workflowType: String(row.workflowType),
        status: String(row.status ?? "SUCCEEDED"),
        subjectType: typeof row.subjectType === "string" ? row.subjectType : undefined,
        subjectId: typeof row.subjectId === "string" ? row.subjectId : undefined,
        input: asRecord(row.inputJson),
        output: asRecord(row.outputJson),
        createdAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : String(row.startedAt ?? row.completedAt ?? ""),
      }));
    }
    return Array.from(this.source.store?.workflowAudits.values() ?? [])
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);
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

  async listRecentSimulationRuns(boundary: P0AuthContextDto = explicitDevBoundary, limit = 20): Promise<ActivitySimulationRunDto[]> {
    return this.repository.listRecentSimulationRuns(boundary, limit);
  }

  async parse(input: { name: string; platform?: string; sourceText: string; rules?: CanonicalRuleDto[] }, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ActivityRuleSetDto> {
    const rules = input.rules ?? deterministicRules(input.sourceText);
    const ruleSet: ActivityRuleSetDto = {
      ruleSetId: nextUuid(),
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
        simulationResultId: nextUuid(),
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
      simulationRunId: nextUuid(),
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
      reportId: nextUuid(),
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
    const details = await this.repository.list(boundary);
    const items = await Promise.all(details.map(async (detail) => ({
      reportId: detail.reportId,
      title: detail.title,
      version: detail.version,
      status: detail.status,
      generatedAt: detail.generatedAt,
      sourceRun: detail.sourceRun,
      exportStatus: await this.repository.getExportStatus(boundary, detail.reportId),
    })));
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

  async compare(baseReportId: string, targetReportId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ReportComparisonDto> {
    const [base, target] = await Promise.all([
      this.repository.getById(boundary, baseReportId),
      this.repository.getById(boundary, targetReportId),
    ]);
    if (!base) throw new Error(`Report not found: ${baseReportId}`);
    if (!target) throw new Error(`Report not found: ${targetReportId}`);
    const basePassRate = reportPassRate(base);
    const targetPassRate = reportPassRate(target);
    const deltaPassedSku = base.summary.passedSku - target.summary.passedSku;
    const deltaRepairableSku = base.summary.repairableSku - target.summary.repairableSku;
    const deltaBlockedSku = base.summary.blockedSku - target.summary.blockedSku;
    return {
      comparisonId: nextId("report_compare"),
      baseReportId,
      targetReportId,
      baseTitle: base.title,
      targetTitle: target.title,
      generatedAt: new Date().toISOString(),
      metrics: {
        basePassRate,
        targetPassRate,
        deltaPassRate: basePassRate - targetPassRate,
        deltaPassedSku,
        deltaRepairableSku,
        deltaBlockedSku,
      },
      summary: `${base.title} 对比 ${target.title}：通过率 ${formatRate(basePassRate)} vs ${formatRate(targetPassRate)}，通过 SKU ${signed(deltaPassedSku)}，可修复 SKU ${signed(deltaRepairableSku)}，阻断 SKU ${signed(deltaBlockedSku)}。`,
      evidenceSummary: [...base.evidenceSummary.slice(0, 5), ...target.evidenceSummary.slice(0, 5)],
    };
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

  async updateNextAction(skuProfileId: string, input: UpdateSkuNextActionInputDto, boundary: P0AuthContextDto): Promise<DashboardSkuReadinessDetailDto> {
    const record = await this.repository.updateNextAction(boundary, skuProfileId, input);
    return toDashboardSkuDetail(record);
  }
}

export class ConnectorManagementService {
  constructor(private readonly repository: ConnectorRepositoryV2) {}

  list(page?: number, pageSize?: number, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorPageDto<ConnectorListItemDto>> | ConnectorPageDto<ConnectorListItemDto> {
    return this.repository.list(boundary, page, pageSize);
  }

  get(connectorId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorDetailDto | null> | ConnectorDetailDto | null {
    return this.repository.get(boundary, connectorId);
  }

  create(input: CreateConnectorDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorDetailDto> | ConnectorDetailDto {
    validateCreateConnector(input);
    return this.repository.create(boundary, input);
  }

  update(connectorId: string, input: UpdateConnectorDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorDetailDto> | ConnectorDetailDto {
    return this.repository.update(boundary, connectorId, input);
  }

  createSyncRun(connectorId: string, input: CreateConnectorSyncRunDto, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorRunDetailDto> | ConnectorRunDetailDto {
    return this.repository.createRun(boundary, connectorId, input);
  }

  listRuns(connectorId: string, page?: number, pageSize?: number, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorPageDto<ConnectorRunSummaryDto>> | ConnectorPageDto<ConnectorRunSummaryDto> {
    return this.repository.listRuns(boundary, connectorId, page, pageSize);
  }

  getRun(connectorRunId: string, boundary: P0AuthContextDto = explicitDevBoundary): Promise<ConnectorRunDetailDto | null> | ConnectorRunDetailDto | null {
    return this.repository.getRun(boundary, connectorRunId);
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

const toolPolicyVersion = "p1";
const forcedDeniedRuntimeTools = ["coding", "file", "bash", "shell", "terminal", "runtime:exec", "prisma:migrate"];
const defaultAllowedAgentTools = [...defaultAgentToolNames];

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
    allowedAgentTools: defaultAllowedAgentTools,
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
  return { allowedAgentTools: settings.allowedAgentTools, deniedRuntimeTools: settings.deniedRuntimeTools, policyVersion: toolPolicyVersion, updatedAt, updatedBy };
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
      workspace.allowedAgentTools = migratedAllowedTools(value);
      workspace.deniedRuntimeTools = asArray(value.deniedRuntimeTools).map(String);
    }
  }
  return workspace;
}

function migrateToolPolicyWorkspace(value: Record<string, unknown>): WorkspaceSettingsDto {
  return normalizeWorkspaceSettings({ ...defaultWorkspaceSettings(), ...value, allowedAgentTools: migratedAllowedTools(value) });
}

function migratedAllowedTools(value: Record<string, unknown>): string[] {
  const current = asArray(value.allowedAgentTools).map(String);
  if (value.policyVersion === toolPolicyVersion) return current;
  return Array.from(new Set([...current, ...defaultAllowedAgentTools]));
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

function matchesDashboardSkuQuery(record: DashboardSkuReadModelRecord, query: DashboardSkuListQuery): boolean {
  const snapshot = record.latestSnapshot;
  const metrics = dashboardKeyMetrics(record);
  const q = query.q?.trim().toLowerCase();
  if (q && !matchesAnyText([record.summary.productName, record.summary.canonicalSkuKey, record.summary.platform, record.summary.storeId, snapshot?.category, metrics.qualityLabel, metrics.sourceKind], q)) return false;
  if (query.skuProfileId && !containsText(record.summary.skuProfileId, query.skuProfileId)) return false;
  if (query.externalSkuId && !containsText(record.summary.canonicalSkuKey, query.externalSkuId)) return false;
  if (query.productName && !containsText(record.summary.productName, query.productName)) return false;
  if (query.storeId && !containsText(record.summary.storeId, query.storeId)) return false;
  if (query.platform && !containsText(record.summary.platform, query.platform)) return false;
  if (query.platforms && !matchesAnyOption(record.summary.platform, query.platforms)) return false;
  if (query.category && !containsText(snapshot?.category, query.category)) return false;
  if (query.categories && !matchesAnyOption(snapshot?.category, query.categories)) return false;
  if (query.healthStatus && toDashboardHealthStatus(record.summary.healthStatus) !== query.healthStatus) return false;
  if (query.healthStatuses && !query.healthStatuses.includes(toDashboardHealthStatus(record.summary.healthStatus))) return false;
  if (query.eligibilityStatus && record.latestSimulationResult?.eligibility !== query.eligibilityStatus) return false;
  if (query.eligibilityStatuses && (!record.latestSimulationResult?.eligibility || !query.eligibilityStatuses.includes(record.latestSimulationResult.eligibility))) return false;
  if (query.certificateStatus && !containsText(snapshot?.certificateStatus, query.certificateStatus)) return false;
  if (query.certificateStatuses && !matchesAnyOption(snapshot?.certificateStatus, query.certificateStatuses)) return false;
  if (query.qualityLabel && !containsText(metrics.qualityLabel, query.qualityLabel)) return false;
  if (query.qualityLabels && !matchesAnyOption(metrics.qualityLabel, query.qualityLabels)) return false;
  if (query.sourceKind && !containsText(metrics.sourceKind, query.sourceKind)) return false;
  if (query.sourceKinds && !matchesAnyOption(metrics.sourceKind, query.sourceKinds)) return false;
  if (!inNumberRange(metrics.sales30d, query.minSales30d, query.maxSales30d)) return false;
  if (!inNumberRange(metrics.positiveRate, query.minPositiveRate, query.maxPositiveRate)) return false;
  if (!inNumberRange(metrics.stock, query.minStock, query.maxStock)) return false;
  if (!inNumberRange(metrics.qualityScore, query.minQualityScore, query.maxQualityScore)) return false;
  if (!inDateRange(metrics.collectedAt, query.collectedAtFrom, query.collectedAtTo)) return false;
  if (!inDateRange(record.updatedAt, query.updatedAtFrom, query.updatedAtTo)) return false;
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
  const metrics = dashboardKeyMetrics(record);
  if (sortBy === "sales30d") return metrics.sales30d ?? 0;
  if (sortBy === "positiveRate") return metrics.positiveRate ?? 0;
  if (sortBy === "stock") return metrics.stock ?? 0;
  if (sortBy === "qualityScore") return metrics.qualityScore ?? 0;
  if (sortBy === "collectedAt") return Date.parse(metrics.collectedAt ?? "") || 0;
  return Date.parse(record.updatedAt) || 0;
}

function matchesAnyText(values: Array<unknown>, needle: string): boolean {
  return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
}

function containsText(value: unknown, query: string): boolean {
  return String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
}

function matchesAnyOption(value: unknown, options: readonly string[]): boolean {
  const normalized = String(value ?? "").toLowerCase();
  return options.some((option) => normalized === option.toLowerCase() || normalized.includes(option.toLowerCase()));
}

function inNumberRange(value: number | undefined, min: number | undefined, max: number | undefined): boolean {
  if (min === undefined && max === undefined) return true;
  if (value === undefined) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

function inDateRange(value: string | undefined, from: string | undefined, to: string | undefined): boolean {
  if (!from && !to) return true;
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return false;
  if (from && time < Date.parse(from)) return false;
  if (to && time > Date.parse(to)) return false;
  return true;
}

function toDashboardSkuListItem(record: DashboardSkuReadModelRecord): DashboardSkuListItemDto {
  const healthStatus = toDashboardHealthStatus(record.summary.healthStatus);
  const eligibilityStatus = record.latestSimulationResult?.eligibility;
  const keyMetrics = dashboardKeyMetrics(record);
  return {
    skuProfileId: record.summary.skuProfileId,
    displaySku: record.summary.canonicalSkuKey,
    productName: record.summary.productName,
    category: record.latestSnapshot?.category,
    sales30d: keyMetrics.sales30d,
    positiveRate: keyMetrics.positiveRate,
    qualityScore: keyMetrics.qualityScore,
    qualityLabel: keyMetrics.qualityLabel,
    sourceKind: keyMetrics.sourceKind,
    stock: keyMetrics.stock,
    healthStatus,
    eligibilityStatus,
    eligibilityLabel: eligibilityLabel(eligibilityStatus),
    nextAction: record.nextActionOverride ?? nextDashboardSkuAction(healthStatus, eligibilityStatus),
    evidenceCount: evidenceRefsForRecord(record).length,
    collectedAt: keyMetrics.collectedAt,
    updatedAt: record.updatedAt,
  };
}

function toDashboardSkuDetail(record: DashboardSkuReadModelRecord): DashboardSkuReadinessDetailDto {
  const evidenceRefs = evidenceRefsForRecord(record);
  const healthStatus = toDashboardHealthStatus(record.summary.healthStatus);
  const eligibilityStatus = record.latestSimulationResult?.eligibility;
  const keyMetrics = dashboardKeyMetrics(record);
  return {
    skuProfileId: record.summary.skuProfileId,
    displaySku: record.summary.canonicalSkuKey,
    productName: record.summary.productName,
    category: record.latestSnapshot?.category,
    platform: record.summary.platform,
    storeId: record.summary.storeId,
    keyMetrics,
    statusSummary: {
      healthStatus,
      eligibilityStatus,
      conclusion: statusConclusion(healthStatus, eligibilityStatus),
      nextStep: (record.nextActionOverride ?? nextDashboardSkuAction(healthStatus, eligibilityStatus)).label,
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

function dashboardKeyMetrics(record: DashboardSkuReadModelRecord): DashboardSkuReadinessDetailDto["keyMetrics"] {
  const snapshot = record.latestSnapshot;
  const normalized = snapshot?.normalized;
  const raw = snapshot?.raw;
  const rawDomMetrics = raw?.domMetrics;
  const domMetrics = rawDomMetrics && typeof rawDomMetrics === "object" && !Array.isArray(rawDomMetrics) ? (rawDomMetrics as Record<string, unknown>) : {};
  return {
    sales30d: snapshot?.sales30d,
    positiveRate: snapshot?.positiveRate,
    qualityScore: numberFromUnknown(normalized?.qualityScore) ?? numberFromUnknown(domMetrics.qualityScore),
    qualityLabel: stringFromUnknown(normalized?.qualityLabel) ?? stringFromUnknown(domMetrics.qualityLabel),
    sourceKind: stringFromUnknown(raw?.extensionSourceKind),
    stock: snapshot?.stock,
    collectedAt: snapshot?.collectedAt,
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

function nextActionFromWorkflowRun(row: Record<string, unknown> | null | undefined): DashboardSkuListItemDto["nextAction"] | undefined {
  const output = row ? asRecord(row.outputJson) : {};
  const input = row ? asRecord(row.inputJson) : {};
  const candidate = asRecord(output.nextAction ?? input.nextAction);
  const type = candidate.type;
  const label = candidate.label;
  if (!isDashboardNextActionType(type) || typeof label !== "string" || !label.trim()) return undefined;
  return { type, label, disabled: typeof candidate.disabled === "boolean" ? candidate.disabled : undefined };
}

function isDashboardNextActionType(value: unknown): value is DashboardSkuListItemDto["nextAction"]["type"] {
  return value === "JOIN_ACTIVITY" || value === "REPAIR_ISSUE" || value === "VIEW_DETAIL" || value === "VIEW_BLOCKER" || value === "MANUAL_REVIEW";
}

function statusConclusion(healthStatus: DashboardSkuHealthStatus, eligibilityStatus: DashboardSkuEligibilityStatus | undefined): string {
  return `${healthStatus} / ${eligibilityLabel(eligibilityStatus)}`;
}

function deterministicRules(sourceText: string): CanonicalRuleDto[] {
  const rules: CanonicalRuleDto[] = [];
  const salesThreshold = matchFirstNumber(sourceText, /(?:近\s*30\s*天)?销量[^0-9一二三四五六七八九十百千万]*[>≥不少于至少]*\s*([0-9]+)/i);
  const stockThreshold = matchFirstNumber(sourceText, /库存[^0-9一二三四五六七八九十百千万]*([0-9]+)/i);
  const positiveRateThreshold = matchPercent(sourceText, /好评[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
  const discountThreshold = matchDiscount(sourceText, /折扣力度[^0-9]*[≥>=不少于至少]*\s*([0-9]+(?:\.[0-9]+)?)\s*折/i);
  const goldQuota = matchFirstNumber(sourceText, /黄金类目[^0-9]*(?:最多|不超过|≤|<=)\s*([0-9]+)/i);
  const diamondQuota = matchFirstNumber(sourceText, /钻石类目[^0-9]*(?:最多|不超过|≤|<=)\s*([0-9]+)/i);
  if (/销量|sales/i.test(sourceText)) rules.push({ id: "sales_30d_min", type: "threshold", field: "sales30d", operator: "gte", value: salesThreshold ?? 100, message: `近 30 天销量不少于 ${salesThreshold ?? 100} 件`, severity: "blocking" });
  if (/库存|stock/i.test(sourceText)) rules.push({ id: "stock_min", type: "threshold", field: "stock", operator: "gte", value: stockThreshold ?? 20, message: `活动库存不少于 ${stockThreshold ?? 20}`, severity: "blocking" });
  if (/好评|positive/i.test(sourceText)) rules.push({ id: "positive_rate", type: "threshold", field: "positiveRate", operator: "gte", value: positiveRateThreshold ?? 0.92, message: `好评率不少于 ${Math.round((positiveRateThreshold ?? 0.92) * 100)}%`, severity: "blocking" });
  if (/证书|certificate/i.test(sourceText)) rules.push({ id: "certificate_valid", type: "threshold", field: "certificateStatus", operator: "eq", value: "valid", message: "证书状态必须有效", severity: "blocking" });
  if (/近\s*30\s*天最低价|最低价|lowest/i.test(sourceText)) rules.push({ id: "campaign_price_lte_lowest_30d", type: "field_compare", field: "campaignPrice", operator: "lte", compareField: "lowestPrice30d", value: 1, message: "活动价不得高于近 30 天最低价", severity: "blocking" });
  if (/折扣力度|折/i.test(sourceText)) rules.push({ id: "campaign_discount_min", type: "field_compare", field: "campaignPrice", operator: "lte", compareField: "originalPrice", value: discountThreshold ?? 0.7, message: `折扣力度至少 ${Math.round((discountThreshold ?? 0.7) * 10)} 折`, severity: "blocking" });
  if (/黄金类目/.test(sourceText)) rules.push({ id: "gold_category_quota", type: "quota", field: "category", operator: "lte", value: goldQuota ?? 5, message: `黄金类目单店最多报名 ${goldQuota ?? 5} 个 SKU`, severity: "warning" });
  if (/钻石类目/.test(sourceText)) rules.push({ id: "diamond_category_quota", type: "quota", field: "category", operator: "lte", value: diamondQuota ?? 10, message: `钻石类目单店最多报名 ${diamondQuota ?? 10} 个 SKU`, severity: "warning" });
  if (/品牌日|互斥|不可重复报名|不能重复报名/.test(sourceText)) rules.push({ id: "brand_day_mutex", type: "threshold", field: "joinedBrandDay", operator: "neq", value: true, message: "已参加品牌日活动的商品不可重复报名", severity: "blocking" });
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

function matchDiscount(sourceText: string, pattern: RegExp): number | undefined {
  const value = matchFirstNumber(sourceText, pattern);
  if (value === undefined) return undefined;
  return value > 1 ? value / 10 : value;
}

function evaluate(snapshot: NormalizedSkuSnapshotDto, rules: CanonicalRuleDto[]): { eligibility: SimulationEligibility; failedRules: CanonicalRuleDto[] } {
  const failedRules = rules.filter((rule) => {
    if (rule.type === "manual_review") return true;
    const actual = rule.field ? snapshot[rule.field as keyof NormalizedSkuSnapshotDto] : undefined;
    const compareActual = rule.compareField ? snapshot[rule.compareField as keyof NormalizedSkuSnapshotDto] : undefined;
    const expected = compareActual !== undefined ? Number(compareActual) * Number(rule.value ?? 1) : Number(rule.value);
    if (compareActual !== undefined && (actual === undefined || !Number.isFinite(expected))) return true;
    if (rule.operator === "gte") return Number(actual) < Number(rule.value);
    if (rule.operator === "lte") return Number(actual) > expected;
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

function reportPassRate(report: ReportDetailDto): number {
  return report.summary.totalSku > 0 ? report.summary.passedSku / report.summary.totalSku : 0;
}

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
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

function connectorTraceRef(entityType: ConnectorTraceableRef["entityType"], entityId: string, label: string): ConnectorTraceableRef {
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
  const subscription = normalizeReportSubscription(row.subscriptionJson, String(row.id));
  return {
    reportId: String(row.id),
    title: String(row.title ?? "报告"),
    version: typeof row.latestVersionId === "string" ? row.latestVersionId : "v1",
    status: toReportStatus(row.status),
    generatedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? new Date().toISOString()),
    tabs: ["SUMMARY", "TASKS", "RULES", "EVIDENCE", "REPAIRS"],
    summary: normalizeReportSummary(summary),
    evidenceSummary: [],
    ...(subscription ? { subscription } : {}),
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

function normalizeReportSubscription(value: unknown, reportId: string): ReportSubscriptionDto | undefined {
  if (!isRecord(value)) return undefined;
  const frequency = value.frequency;
  if (frequency !== "DAILY" && frequency !== "WEEKLY" && frequency !== "MONTHLY" && frequency !== "OFF") return undefined;
  return {
    reportId: typeof value.reportId === "string" ? value.reportId : reportId,
    frequency,
    recipients: asArray(value.recipients).map(String).filter(Boolean),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
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

function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function validateCreateConnector(input: CreateConnectorDto): void {
  if (!input.code || !input.name || !input.kind) throw new Error("code, name and kind are required");
}

function normalizeConnectorStatus(value: unknown): ConnectorListItemDto["status"] {
  const upper = String(value ?? "ACTIVE").toUpperCase();
  if (upper === "INACTIVE" || upper === "NEEDS_AUTH" || upper === "FAILED" || upper === "DISABLED") return upper;
  return "ACTIVE";
}

function normalizeConnectorRunStatus(value: unknown): ConnectorRunSummaryDto["status"] {
  const upper = String(value ?? "PENDING").toUpperCase();
  if (upper === "RUNNING" || upper === "SUCCEEDED" || upper === "FAILED") return upper;
  return "PENDING";
}

function normalizeConnectorQualityScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function sanitizeConnectorConfig(config: Record<string, unknown>): Record<string, unknown> {
  return redactSensitiveValue(config) as Record<string, unknown>;
}

function permissionsFromConfig(config: Record<string, unknown>): Array<{ key: string; label: string; granted: boolean }> {
  const permissions = Array.isArray(config.permissions) ? config.permissions.map(String) : [];
  return [
    { key: "read_product", label: "读取商品信息", granted: permissions.includes("read_product") || permissions.length === 0 },
    { key: "read_inventory", label: "读取库存信息", granted: permissions.includes("read_inventory") || permissions.length === 0 },
    { key: "write_product", label: "修改商品信息", granted: false },
  ];
}

function permissionSummary(config: Record<string, unknown>): string {
  const granted = permissionsFromConfig(config).filter((item) => item.granted).length;
  return `已授权 ${granted} 项，只读采集，不保存 cookie/token`;
}

function connectorConfigSummary(config: Record<string, unknown>): string {
  const source = typeof config.source === "string" ? config.source : "manual";
  const cadence = typeof config.cadence === "string" ? config.cadence : "on_demand";
  return `${source} / ${cadence}`;
}

function toConnectorRunSummary(run: ConnectorRunRecordDto): ConnectorRunSummaryDto {
  return {
    connectorRunId: run.connectorRunId,
    connectorId: run.connectorId,
    status: normalizeConnectorRunStatus(run.status),
    rowCount: run.rowCount,
    qualityScore: run.qualityScore,
    warnings: run.warnings,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    workflowRunRef: run.workflowRunId ? connectorTraceRef("workflow_run", run.workflowRunId, "connector_sync 审计") : undefined,
    traceRef: connectorTraceRef("connector_run", run.connectorRunId, `采集运行 ${run.connectorRunId}`),
  };
}

function toConnectorRunDetail(run: ConnectorRunRecordDto, connector: ConnectorRecordDto): ConnectorRunDetailDto {
  return { ...toConnectorRunSummary(run), summary: run.summary, connectorRef: connectorTraceRef("connector", connector.connectorId, connector.name) };
}

function toConnectorRecord(row: Record<string, unknown>): ConnectorRecordDto {
  return {
    connectorId: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    kind: String(row.kind ?? ""),
    platform: typeof row.platform === "string" ? row.platform : undefined,
    config: isRecord(row.configJson) ? row.configJson : {},
    status: String(row.status ?? "active"),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

function toConnectorRunRecord(row: Record<string, unknown>): ConnectorRunRecordDto {
  return {
    connectorRunId: String(row.id),
    connectorId: String(row.connectorId),
    workflowRunId: typeof row.workflowRunId === "string" ? row.workflowRunId : undefined,
    status: normalizeConnectorRunStatus(row.status),
    rowCount: Number(row.rowCount ?? 0),
    qualityScore: row.qualityScore === null || row.qualityScore === undefined ? undefined : Number(row.qualityScore),
    warnings: asArray(row.warningsJson).map(String),
    summary: isRecord(row.summaryJson) ? row.summaryJson : {},
    startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : typeof row.startedAt === "string" ? row.startedAt : undefined,
    completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : typeof row.completedAt === "string" ? row.completedAt : undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

function inferFieldMappings(rows: Array<Record<string, unknown>>): Array<{ sourceField: string; targetField: string; confidence: number }> {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const targets: Record<string, string> = {
    sku: "externalSkuId",
    skuId: "externalSkuId",
    itemId: "externalSkuId",
    title: "productName",
    productName: "productName",
    name: "productName",
    stock: "stock",
    inventory: "stock",
    sales30d: "sales30d",
    sales: "sales30d",
    positiveRate: "positiveRate",
    certificateStatus: "certificateStatus",
  };
  return keys.slice(0, 12).map((key) => ({ sourceField: key, targetField: targets[key] ?? key, confidence: targets[key] ? 0.9 : 0.55 }));
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
    const connectorService = new ConnectorManagementService(new PrismaConnectorRepositoryV2(options.prisma));
    const browserConnectorService = new BrowserConnectorService();
    const ruleSetService = new RuleSetService(tx, new PrismaIngestRepository(), new PrismaRuleSetRepository(options.prisma));
    const workspaceSettingsService = new WorkspaceSettingsService(tx, new PrismaIngestRepository(), new PrismaWorkspaceSettingsRepository(options.prisma));
    const workflowAuditService = new WorkflowAuditQueryService({ prisma: options.prisma });
    return { adapter, store: memoryStore, tx, ingestService, skuReadinessQueryService, activityService, reviewService, reportService, connectorService, browserConnectorService, ruleSetService, workspaceSettingsService, workflowAuditService };
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
  const connectorService = new ConnectorManagementService(new ConnectorRepositoryV2(store));
  const browserConnectorService = new BrowserConnectorService();
  const auditRepository = new IngestRepository();
  const ruleSetService = new RuleSetService(tx, auditRepository, new RuleSetRepository(store));
  const workspaceSettingsService = new WorkspaceSettingsService(tx, auditRepository, new WorkspaceSettingsRepository(store));
  const workflowAuditService = new WorkflowAuditQueryService({ store });
  return { adapter, store, tx, ingestService, skuReadinessQueryService, activityService, reviewService, reportService, connectorService, browserConnectorService, ruleSetService, workspaceSettingsService, workflowAuditService };
}
