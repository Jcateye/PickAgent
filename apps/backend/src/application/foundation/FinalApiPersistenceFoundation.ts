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
  TraceableRef,
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
  connector: PrismaDelegate;
  connectorRun: PrismaDelegate;
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
  readonly connectors = new Map<string, ConnectorRecordDto>();
  readonly connectorRuns = new Map<string, ConnectorRunRecordDto>();
  readonly workflowAudits = new Map<string, WorkflowAuditRecord>();
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
      qualityScore: input.qualityScore,
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
      traceRef: traceRef("connector", record.connectorId, record.name),
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
      traceRef: traceRef("connector", "browser-page-detection", "浏览器页面识别"),
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
    const now = new Date();
    const workflowRunId = nextUuid();
    await this.prisma.workflowRun.create({ data: { id: workflowRunId, workflowType: "connector_sync", status: "SUCCEEDED", subjectType: "connector", subjectId: connectorId, inputJson: { connectorId, actorId: boundary.actorId, tenantId: boundary.tenantId, surface: boundary.surface }, outputJson: { rowCount: input.rowCount ?? 0, qualityScore: input.qualityScore }, startedAt: now, completedAt: now } });
    const created = await this.prisma.connectorRun.create({ data: { connectorId, workflowRunId, status: "succeeded", rowCount: input.rowCount ?? 0, qualityScore: input.qualityScore, warningsJson: input.warnings ?? [], summaryJson: input.summary ?? {}, startedAt: now, completedAt: now } });
    const connector = await this.prisma.connector.findUnique({ where: { id: connectorId } });
    if (!connector) throw new Error(`Connector not found: ${connectorId}`);
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
      traceRef: traceRef("connector", record.connectorId, record.name),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
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

function sanitizeConnectorConfig(config: Record<string, unknown>): Record<string, unknown> {
  return redactSensitiveValue(config) as Record<string, unknown>;
}

function traceRef(entityType: TraceableRef["entityType"], entityId: string, label: string): TraceableRef {
  return { entityType, entityId, label, drawerTarget: `${entityType}:${entityId}` };
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
    workflowRunRef: run.workflowRunId ? traceRef("workflow_run", run.workflowRunId, "connector_sync 审计") : undefined,
    traceRef: traceRef("connector_run", run.connectorRunId, `采集运行 ${run.connectorRunId}`),
  };
}

function toConnectorRunDetail(run: ConnectorRunRecordDto, connector: ConnectorRecordDto): ConnectorRunDetailDto {
  return { ...toConnectorRunSummary(run), summary: run.summary, connectorRef: traceRef("connector", connector.connectorId, connector.name) };
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
    const ingestService = new FinalIngestService(tx, new PrismaIngestRepository(), skuQueryRepository);
    const activityService = new FinalActivityService(new PrismaActivityRepository(options.prisma), skuQueryRepository);
    const memoryStore = new FinalApiPersistenceStore();
    const reviewService = new FinalReviewService(new PrismaReviewRepository(options.prisma));
    const reportService = new FinalReportService(new PrismaReportRepository(options.prisma), skuQueryRepository);
    const connectorService = new ConnectorManagementService(new PrismaConnectorRepositoryV2(options.prisma));
    const browserConnectorService = new BrowserConnectorService();
    return { adapter, store: memoryStore, tx, ingestService, activityService, reviewService, reportService, connectorService, browserConnectorService };
  }
  const store = new FinalApiPersistenceStore();
  const tx = new InMemoryTransactionManager(store);
  const skuQueryRepository = new SkuQueryRepository(store);
  const ingestService = new FinalIngestService(tx, new IngestRepository(), skuQueryRepository);
  const activityService = new FinalActivityService(new ActivityRepository(store), skuQueryRepository);
  const reviewService = new FinalReviewService(new ReviewRepository(store));
  const reportService = new FinalReportService(new ReportRepository(store), skuQueryRepository);
  const connectorService = new ConnectorManagementService(new ConnectorRepositoryV2(store));
  const browserConnectorService = new BrowserConnectorService();
  return { adapter, store, tx, ingestService, activityService, reviewService, reportService, connectorService, browserConnectorService };
}
