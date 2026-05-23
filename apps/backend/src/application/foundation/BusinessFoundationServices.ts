import {
  type ActivityRuleSetDto,
  type AgentToolDefinitionDto,
  type AgentToolExecutionDto,
  type AgentToolName,
  BusinessFoundationSchemaNames,
  type CanonicalRuleDto,
  type DataFreshnessDto,
  type DecisionExplanationDto,
  type EvidenceLinkDto,
  type HealthDiagnosisDto,
  type HealthStatus,
  type IngestPayloadDto,
  type IngestRowDto,
  type NormalizedSkuSnapshotDto,
  type ReportPreviewDto,
  type ReviewDecision,
  type ReviewItemDto,
  type ReviewStatus,
  type SimulationEligibility,
  type SimulationRequestDto,
  type SimulationResultDto,
  type SkuDetailDto,
  type SkuSummaryDto,
  assertValidIngestPayload,
  assertValidRuleSet,
} from "../../../../contracts/types/businessFoundation";
import { FakeAgentLoopAdapter } from "../agent/AgentLoopAdapters";

type SkuProfileRecord = {
  skuProfileId: string;
  canonicalSkuKey: string;
  platform: string;
  storeId: string;
  externalSkuId: string;
  productName: string;
  category?: string;
  brand?: string;
};

export class BusinessFoundationStore {
  readonly profiles = new Map<string, SkuProfileRecord>();
  readonly snapshots = new Map<string, NormalizedSkuSnapshotDto>();
  readonly diagnoses = new Map<string, HealthDiagnosisDto>();
  readonly projections = new Map<string, SkuSummaryDto>();
  readonly ruleSets = new Map<string, ActivityRuleSetDto>();
  readonly simulations = new Map<string, SimulationResultDto>();
  readonly reviews = new Map<string, ReviewItemDto>();
  readonly reports = new Map<string, ReportPreviewDto>();
}

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString().padStart(4, "0")}`;
}

function canonicalSkuKey(row: IngestRowDto): string {
  return `${row.platform}:${row.storeId}:${row.externalSkuId}`;
}

function evidence(type: EvidenceLinkDto["type"], entityId: string, label: string, summary: string): EvidenceLinkDto {
  return { type, entityId, label, summary };
}

export class NormalizationService {
  normalize(row: IngestRowDto, skuProfileId: string, collectedAt: string): NormalizedSkuSnapshotDto {
    const productName = row.productName?.trim() || String(row.raw.productName ?? row.raw.title ?? row.externalSkuId);
    return {
      snapshotId: nextId("snapshot"),
      skuProfileId,
      collectedAt,
      productName,
      category: row.category,
      brand: row.brand,
      sales30d: row.sales30d,
      positiveRate: row.positiveRate,
      stock: row.stock,
      originalPrice: row.originalPrice,
      lowestPrice30d: row.lowestPrice30d,
      campaignPrice: row.campaignPrice,
      joinedBrandDay: row.joinedBrandDay,
      certificateStatus: row.certificateStatus,
      raw: row.raw,
      normalized: {
        platform: row.platform,
        storeId: row.storeId,
        externalSkuId: row.externalSkuId,
        productName,
        sales30d: row.sales30d ?? null,
        stock: row.stock ?? null,
        certificateStatus: row.certificateStatus ?? null,
      },
    };
  }
}

export class HealthAssessmentService {
  assess(snapshot: NormalizedSkuSnapshotDto): HealthDiagnosisDto {
    const issues: string[] = [];
    const nextActions: string[] = [];
    let score = 100;
    let dataQualityScore = 100;

    if ((snapshot.stock ?? 0) <= 0) {
      issues.push("库存不足");
      nextActions.push("补充可售库存");
      score -= 35;
    }
    if ((snapshot.positiveRate ?? 1) < 0.92) {
      issues.push("好评率偏低");
      nextActions.push("检查差评原因并准备客服处理");
      score -= 20;
    }
    if (!snapshot.certificateStatus || snapshot.certificateStatus !== "valid") {
      issues.push("资质证书未通过");
      nextActions.push("补全或更新证书资料");
      score -= 30;
    }
    for (const field of ["sales30d", "stock", "positiveRate"] as const) {
      if (snapshot[field] === undefined) {
        dataQualityScore -= 15;
      }
    }

    const healthScore = Math.max(0, score);
    const healthStatus: HealthStatus = healthScore >= 80 ? "READY" : healthScore >= 50 ? "WARNING" : "BLOCKED";
    const diagnosisId = nextId("diagnosis");
    return {
      diagnosisId,
      skuProfileId: snapshot.skuProfileId,
      snapshotId: snapshot.snapshotId,
      healthStatus,
      healthScore,
      dataQualityScore: Math.max(0, dataQualityScore),
      issues,
      nextActions,
      evidence: [evidence("snapshot", snapshot.snapshotId, "最新采集快照", "健康诊断基于最新标准化采集事实生成")],
      diagnosedAt: new Date().toISOString(),
    };
  }
}

export class IngestService {
  constructor(
    private readonly store: BusinessFoundationStore,
    private readonly normalizationService = new NormalizationService(),
    private readonly healthAssessmentService = new HealthAssessmentService(),
  ) {}

  ingest(payload: IngestPayloadDto): { summaries: SkuSummaryDto[]; snapshots: NormalizedSkuSnapshotDto[]; diagnoses: HealthDiagnosisDto[] } {
    assertValidIngestPayload(payload);
    const summaries: SkuSummaryDto[] = [];
    const snapshots: NormalizedSkuSnapshotDto[] = [];
    const diagnoses: HealthDiagnosisDto[] = [];

    for (const row of payload.rows) {
      const key = canonicalSkuKey(row);
      const existing = this.store.profiles.get(key);
      const profile =
        existing ??
        ({
          skuProfileId: nextId("sku"),
          canonicalSkuKey: key,
          platform: row.platform,
          storeId: row.storeId,
          externalSkuId: row.externalSkuId,
          productName: row.productName?.trim() || String(row.raw.productName ?? row.raw.title ?? row.externalSkuId),
          category: row.category,
          brand: row.brand,
        } satisfies SkuProfileRecord);
      this.store.profiles.set(key, profile);

      const snapshot = this.normalizationService.normalize(row, profile.skuProfileId, payload.collectedAt);
      const diagnosis = this.healthAssessmentService.assess(snapshot);
      const summary = toSummary(profile, diagnosis);

      this.store.snapshots.set(snapshot.snapshotId, snapshot);
      this.store.diagnoses.set(diagnosis.diagnosisId, diagnosis);
      this.store.projections.set(profile.skuProfileId, summary);
      snapshots.push(snapshot);
      diagnoses.push(diagnosis);
      summaries.push(summary);
    }

    return { summaries, snapshots, diagnoses };
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

export class SkuQueryService {
  constructor(private readonly store: BusinessFoundationStore) {}

  getHealthSummary(): { total: number; ready: number; warning: number; blocked: number } {
    const summaries = Array.from(this.store.projections.values());
    return {
      total: summaries.length,
      ready: summaries.filter((item) => item.healthStatus === "READY").length,
      warning: summaries.filter((item) => item.healthStatus === "WARNING").length,
      blocked: summaries.filter((item) => item.healthStatus === "BLOCKED").length,
    };
  }

  listSkus(): SkuSummaryDto[] {
    return Array.from(this.store.projections.values());
  }

  getSkuDetail(skuProfileId: string): SkuDetailDto | null {
    const summary = this.store.projections.get(skuProfileId);
    if (!summary) return null;
    const latestSnapshot = Array.from(this.store.snapshots.values()).find((item) => item.skuProfileId === skuProfileId) ?? null;
    const latestDiagnosis = Array.from(this.store.diagnoses.values()).find((item) => item.skuProfileId === skuProfileId) ?? null;
    return {
      ...summary,
      latestSnapshot,
      latestDiagnosis,
      evidence: [
        ...(latestSnapshot ? [evidence("snapshot", latestSnapshot.snapshotId, "采集事实", "当前读模型关联的最新采集事实")] : []),
        ...(latestDiagnosis ? [evidence("diagnosis", latestDiagnosis.diagnosisId, "健康诊断", "当前读模型关联的最新健康诊断")] : []),
      ],
    };
  }

  getLatestDiagnosis(skuProfileId: string): HealthDiagnosisDto | null {
    return Array.from(this.store.diagnoses.values()).find((item) => item.skuProfileId === skuProfileId) ?? null;
  }

  checkDataFreshness(input: { skuProfileId: string; maxAgeHours?: number; now?: string }): DataFreshnessDto {
    const detail = this.getSkuDetail(input.skuProfileId);
    if (!detail?.latestSnapshot) {
      return {
        skuProfileId: input.skuProfileId,
        snapshotId: null,
        collectedAt: null,
        checkedAt: input.now ?? new Date().toISOString(),
        maxAgeHours: input.maxAgeHours ?? 24,
        ageHours: null,
        isFresh: false,
        reason: "缺少最新采集快照",
        evidence: [],
      };
    }
    const checkedAt = input.now ?? new Date().toISOString();
    const maxAgeHours = input.maxAgeHours ?? 24;
    const ageHours = (Date.parse(checkedAt) - Date.parse(detail.latestSnapshot.collectedAt)) / 3_600_000;
    const isFresh = Number.isFinite(ageHours) && ageHours <= maxAgeHours;
    return {
      skuProfileId: input.skuProfileId,
      snapshotId: detail.latestSnapshot.snapshotId,
      collectedAt: detail.latestSnapshot.collectedAt,
      checkedAt,
      maxAgeHours,
      ageHours,
      isFresh,
      reason: isFresh ? "采集快照仍在时效窗口内" : "采集快照已超出时效窗口",
      evidence: [evidence("snapshot", detail.latestSnapshot.snapshotId, "最新采集快照", "数据新鲜度基于最新采集时间计算")],
    };
  }

  explainDecisionWithEvidence(input: { skuProfileId: string; simulationResultId?: string; question?: string }): DecisionExplanationDto {
    const detail = this.getSkuDetail(input.skuProfileId);
    if (!detail?.latestDiagnosis) {
      throw new Error(`SKU detail not found: ${input.skuProfileId}`);
    }
    const simulation = input.simulationResultId ? this.store.simulations.get(input.simulationResultId) ?? null : null;
    const healthSummary = detail.topIssues.length ? `当前主要问题：${detail.topIssues.join("；")}` : "当前未发现显著健康风险";
    const simulationSummary = simulation ? `活动准入结果：${simulation.eligibility}` : "尚未绑定活动模拟结果";
    const nextActions = [...detail.nextActions, ...(simulation?.repairSuggestions ?? [])].slice(0, 4);
    return {
      skuProfileId: input.skuProfileId,
      summary: `${healthSummary}。${simulationSummary}。`,
      recommendation: input.question ? `围绕“${input.question}”建议先核对 evidence 再做人工决策。` : "建议先核对 evidence，再决定是否进入 Review Gate。",
      evidence: [...detail.evidence, ...(simulation?.evidence ?? [])],
      nextActions,
    };
  }
}

export class ActivityRuleService {
  constructor(private readonly store: BusinessFoundationStore) {}

  parseRules(input: { name: string; platform?: string; sourceText: string; rules?: CanonicalRuleDto[] }): ActivityRuleSetDto {
    const errors: string[] = [];
    const rules = input.rules ?? deterministicRules(input.sourceText);
    const ruleSet: ActivityRuleSetDto = {
      ruleSetId: nextId("rules"),
      name: input.name,
      platform: input.platform,
      sourceText: input.sourceText,
      rules,
      parseStatus: rules.some((rule) => rule.type === "manual_review") ? "NEEDS_REVIEW" : "PARSED",
      confidence: rules.length > 0 ? 0.86 : 0.2,
      errors,
    };

    try {
      assertValidRuleSet(ruleSet);
    } catch (error) {
      ruleSet.parseStatus = "FAILED";
      ruleSet.confidence = 0;
      ruleSet.errors.push(error instanceof Error ? error.message : "Rule DSL validation failed");
    }
    this.store.ruleSets.set(ruleSet.ruleSetId, ruleSet);
    return ruleSet;
  }
}

function deterministicRules(sourceText: string): CanonicalRuleDto[] {
  const rules: CanonicalRuleDto[] = [];
  const stockThreshold = matchFirstNumber(sourceText, /库存[^0-9一二三四五六七八九十百千万]*([0-9]+)/i);
  const positiveRateThreshold = matchPercent(sourceText, /好评[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
  if (/库存|stock/i.test(sourceText)) {
    rules.push({
      id: "stock_min",
      type: "threshold",
      field: "stock",
      operator: "gte",
      value: stockThreshold ?? 20,
      message: `活动库存不少于 ${stockThreshold ?? 20}`,
      severity: "blocking",
    });
  }
  if (/好评|positive/i.test(sourceText)) {
    rules.push({
      id: "positive_rate",
      type: "threshold",
      field: "positiveRate",
      operator: "gte",
      value: positiveRateThreshold ?? 0.92,
      message: `好评率不少于 ${Math.round((positiveRateThreshold ?? 0.92) * 100)}%`,
      severity: "blocking",
    });
  }
  if (/证书|certificate/i.test(sourceText)) {
    rules.push({ id: "certificate_valid", type: "threshold", field: "certificateStatus", operator: "eq", value: "valid", message: "证书状态必须有效", severity: "blocking" });
  }
  if (/商机|business_chance_center|clue/i.test(sourceText)) {
    rules.push({ id: "business_chance_manual_review", type: "manual_review", message: "business_chance_center 商机线索需要人工确认后才能转成活动规则", severity: "warning" });
  }
  if (/人工|manual/i.test(sourceText)) {
    rules.push({ id: "manual_check", type: "manual_review", message: "需要人工确认活动规则歧义", severity: "warning" });
  }
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

export class ActivitySimulationService {
  constructor(private readonly store: BusinessFoundationStore, private readonly skuQueryService = new SkuQueryService(store)) {}

  runSimulation(request: SimulationRequestDto): SimulationResultDto[] {
    const ruleSet = this.store.ruleSets.get(request.ruleSetId);
    if (!ruleSet || ruleSet.parseStatus === "FAILED") {
      throw new Error("Valid rule set is required before simulation");
    }

    return request.skuProfileIds.map((skuProfileId) => {
      const detail = this.skuQueryService.getSkuDetail(skuProfileId);
      if (!detail?.latestSnapshot) {
        throw new Error(`SKU detail not found: ${skuProfileId}`);
      }
      const original = evaluate(detail.latestSnapshot, ruleSet.rules);
      const changedSnapshot = request.whatIf ? { ...detail.latestSnapshot, ...request.whatIf } : detail.latestSnapshot;
      const changed = evaluate(changedSnapshot, ruleSet.rules);
      const result: SimulationResultDto = {
        simulationResultId: nextId("simulation"),
        skuProfileId,
        ruleSetId: request.ruleSetId,
        eligibility: changed.eligibility,
        failedRules: changed.failedRules,
        evidence: [evidence("rule", request.ruleSetId, "活动规则集", "准入模拟基于 Canonical Rule DSL 执行"), evidence("snapshot", detail.latestSnapshot.snapshotId, "SKU 快照", "模拟读取当前 SKU 快照，不修改真实档案")],
        repairSuggestions: changed.failedRules.map((rule) => repairSuggestion(rule)),
        originalEligibility: request.whatIf ? original.eligibility : undefined,
      };
      this.store.simulations.set(result.simulationResultId, result);
      return result;
    });
  }

  simulateActivityReadiness(request: SimulationRequestDto): SimulationResultDto[] {
    return this.runSimulation(request);
  }
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

export class ReviewService {
  constructor(private readonly store: BusinessFoundationStore) {}

  createReviewItems(items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">>): ReviewItemDto[] {
    return items.map((item) => {
      const review: ReviewItemDto = { ...item, reviewItemId: nextId("review"), status: "OPEN" };
      this.store.reviews.set(review.reviewItemId, review);
      return review;
    });
  }

  decide(reviewItemId: string, decision: ReviewDecision, decisionBy: string, decisionComment?: string): ReviewItemDto {
    const current = this.store.reviews.get(reviewItemId);
    if (!current) throw new Error(`Review item not found: ${reviewItemId}`);
    const statusByDecision: Record<ReviewDecision, ReviewStatus> = {
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      REQUEST_CHANGES: "CHANGES_REQUESTED",
    };
    const updated = { ...current, status: statusByDecision[decision], decision, decisionBy, decisionComment, decidedAt: new Date().toISOString() };
    this.store.reviews.set(reviewItemId, updated);
    return updated;
  }
}

export class ReportService {
  constructor(private readonly store: BusinessFoundationStore, private readonly skuQueryService = new SkuQueryService(store)) {}

  generatePreview(input: { type: "HEALTH" | "ACTIVITY"; skuProfileIds: string[]; simulationResultIds?: string[] }): ReportPreviewDto {
    const details = input.skuProfileIds.map((id) => this.skuQueryService.getSkuDetail(id)).filter((item): item is SkuDetailDto => item !== null);
    const simulations = (input.simulationResultIds ?? []).map((id) => this.store.simulations.get(id)).filter((item): item is SimulationResultDto => item !== undefined);
    const simulationEvidence = simulations.map((result) => evidence("simulation", result.simulationResultId, "活动模拟", `准入状态：${result.eligibility}`));
    const unresolvedHealthRisks = details.filter((item) => item.healthStatus !== "READY").flatMap((item) => item.topIssues.map((issue) => `${item.productName}：${issue}`));
    const unresolvedSimulationRisks = simulations
      .filter((item) => item.eligibility === "MANUAL_REVIEW" || item.eligibility === "BLOCKED")
      .map((item) => `${item.simulationResultId}：${item.eligibility}，失败规则 ${item.failedRules.length} 条`);
    const unresolvedRisks = [...unresolvedHealthRisks, ...unresolvedSimulationRisks];
    const report: ReportPreviewDto = {
      reportId: nextId("report"),
      type: input.type,
      status: "PREVIEW",
      title: input.type === "HEALTH" ? "SKU 健康报告预览" : "活动准入报告预览",
      sections: [
        {
          id: "summary",
          title: "摘要",
          summary: `覆盖 ${details.length} 个 SKU，阻塞 ${details.filter((item) => item.healthStatus === "BLOCKED").length} 个。`,
          evidence: details.flatMap((item) => item.evidence),
        },
        {
          id: "next_actions",
          title: "下一步动作",
          summary: details.flatMap((item) => item.nextActions).join("；") || "暂无下一步动作",
          evidence: simulationEvidence,
        },
        {
          id: "unresolved_risks",
          title: "未解决风险",
          summary: unresolvedRisks.length ? unresolvedRisks.join("；") : "当前预览没有未解决阻塞或人工确认风险",
          evidence: [...details.flatMap((item) => item.evidence), ...simulationEvidence],
        },
      ],
      evidenceSummary: [...details.flatMap((item) => item.evidence), ...simulationEvidence],
    };
    this.store.reports.set(report.reportId, report);
    return report;
  }
}

export class AgentToolRegistry {
  private readonly definitions: AgentToolDefinitionDto[] = [
    { name: "getSkuSummary", description: "读取 SKU 当前健康摘要", inputSchemaName: "SkuIdInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.skuDetail },
    { name: "parseActivityRules", description: "解析并校验活动规则 DSL", inputSchemaName: "ActivityRuleParseInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.ruleSet },
    { name: "simulateActivityReadiness", description: "执行活动准入模拟或 what-if 模拟", inputSchemaName: "SimulationRequestZodSchema", outputSchemaName: BusinessFoundationSchemaNames.simulationResult },
    { name: "runSimulation", description: "执行活动准入模拟或 what-if 模拟", inputSchemaName: "SimulationRequestZodSchema", outputSchemaName: BusinessFoundationSchemaNames.simulationResult },
    { name: "checkDataFreshness", description: "检查 SKU 采集数据是否仍在时效窗口内", inputSchemaName: "DataFreshnessInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.dataFreshness },
    { name: "diagnoseSkuHealth", description: "返回 SKU 最新健康诊断", inputSchemaName: "SkuIdInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.skuDetail },
    { name: "createReviewItems", description: "创建结构化人工 Review 项", inputSchemaName: "ReviewCreateInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.reviewItem },
    { name: "explainDecisionWithEvidence", description: "基于健康诊断和模拟结果输出决策解释", inputSchemaName: "DecisionExplanationInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.decisionExplanation },
    { name: "generateReportPreview", description: "生成健康或活动报告预览", inputSchemaName: "ReportPreviewInputZodSchema", outputSchemaName: BusinessFoundationSchemaNames.reportPreview },
  ];

  constructor(
    private readonly skuQueryService: SkuQueryService,
    private readonly activityRuleService: ActivityRuleService,
    private readonly activitySimulationService: ActivitySimulationService,
    private readonly reviewService: ReviewService,
    private readonly reportService: ReportService,
  ) {}

  listTools(): AgentToolDefinitionDto[] {
    return this.definitions;
  }

  execute(toolName: AgentToolName, input: unknown): AgentToolExecutionDto {
    const toolCallId = nextId("tool");
    try {
      const result = this.executeResult(toolName, input);
      return {
        toolCallId,
        toolName,
        status: "SUCCEEDED",
        result,
        linkedEntity: linkedEntityFor(toolName, result),
        evidence: evidenceFor(result),
        trace: [{ step: "service_boundary", summary: "Agent 工具通过 application service 执行，没有直接访问数据库" }],
      };
    } catch (error) {
      return {
        toolCallId,
        toolName,
        status: "FAILED",
        evidence: [],
        trace: [{ step: "error", summary: error instanceof Error ? error.message : "Agent tool execution failed" }],
      };
    }
  }

  private executeResult(toolName: AgentToolName, input: unknown): unknown {
    if (toolName === "getSkuSummary") return this.skuQueryService.getSkuDetail((input as { skuProfileId: string }).skuProfileId);
    if (toolName === "parseActivityRules") return this.activityRuleService.parseRules(input as { name: string; platform?: string; sourceText: string; rules?: CanonicalRuleDto[] });
    if (toolName === "simulateActivityReadiness" || toolName === "runSimulation") return this.activitySimulationService.simulateActivityReadiness(input as SimulationRequestDto);
    if (toolName === "checkDataFreshness") return this.skuQueryService.checkDataFreshness(input as { skuProfileId: string; maxAgeHours?: number; now?: string });
    if (toolName === "diagnoseSkuHealth") return this.skuQueryService.getLatestDiagnosis((input as { skuProfileId: string }).skuProfileId);
    if (toolName === "createReviewItems") return this.reviewService.createReviewItems((input as { items: Array<Omit<ReviewItemDto, "reviewItemId" | "status">> }).items);
    if (toolName === "explainDecisionWithEvidence") {
      return this.skuQueryService.explainDecisionWithEvidence(input as { skuProfileId: string; simulationResultId?: string; question?: string });
    }
    if (toolName === "generateReportPreview") return this.reportService.generatePreview(input as { type: "HEALTH" | "ACTIVITY"; skuProfileIds: string[]; simulationResultIds?: string[] });
    throw new Error(`Unknown agent tool: ${toolName}`);
  }
}

function linkedEntityFor(toolName: AgentToolName, result: unknown): { type: string; id: string } | undefined {
  if (toolName === "parseActivityRules") return { type: "activity_rule_set", id: (result as ActivityRuleSetDto).ruleSetId };
  if (toolName === "generateReportPreview") return { type: "report", id: (result as ReportPreviewDto).reportId };
  return undefined;
}

function evidenceFor(result: unknown): EvidenceLinkDto[] {
  if (Array.isArray(result)) return result.flatMap((item) => evidenceFor(item));
  if (result && typeof result === "object" && "evidence" in result && Array.isArray((result as { evidence: unknown }).evidence)) {
    return (result as { evidence: EvidenceLinkDto[] }).evidence;
  }
  if (result && typeof result === "object" && "evidenceSummary" in result && Array.isArray((result as { evidenceSummary: unknown }).evidenceSummary)) {
    return (result as { evidenceSummary: EvidenceLinkDto[] }).evidenceSummary;
  }
  return [];
}

export function createBusinessFoundationRuntime(): {
  store: BusinessFoundationStore;
  ingestService: IngestService;
  skuQueryService: SkuQueryService;
  activityRuleService: ActivityRuleService;
  activitySimulationService: ActivitySimulationService;
  reviewService: ReviewService;
  reportService: ReportService;
  agentToolRegistry: AgentToolRegistry;
  fakeAgentLoopAdapter: FakeAgentLoopAdapter;
} {
  const store = new BusinessFoundationStore();
  const skuQueryService = new SkuQueryService(store);
  const activityRuleService = new ActivityRuleService(store);
  const activitySimulationService = new ActivitySimulationService(store, skuQueryService);
  const reviewService = new ReviewService(store);
  const reportService = new ReportService(store, skuQueryService);
  const ingestService = new IngestService(store);
  const agentToolRegistry = new AgentToolRegistry(skuQueryService, activityRuleService, activitySimulationService, reviewService, reportService);
  const fakeAgentLoopAdapter = new FakeAgentLoopAdapter(agentToolRegistry);
  return { store, ingestService, skuQueryService, activityRuleService, activitySimulationService, reviewService, reportService, agentToolRegistry, fakeAgentLoopAdapter };
}
