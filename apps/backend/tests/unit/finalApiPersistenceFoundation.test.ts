import assert from "node:assert/strict";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { createFinalApiPersistenceRuntime, FinalActivityService, PrismaActivityRepository, PrismaConnectorRepositoryV2, PrismaDashboardSkuReadModelRepository, PrismaReportRepository, PrismaReviewRepository, WorkflowAuditQueryService } from "../../src/application/foundation/FinalApiPersistenceFoundation";
import { P0AuthBoundaryError, type P0AuthContextDto } from "../../src/application/foundation/P0AuthBoundaryRuntimeConfig";

const tenantA: P0AuthContextDto = {
  actorId: "actor_a",
  tenantId: "tenant_a",
  sessionId: "session_a",
  surface: "api-test",
  requestId: "request_a",
};

const tenantB: P0AuthContextDto = {
  actorId: "actor_b",
  tenantId: "tenant_b",
  sessionId: "session_b",
  surface: "api-test",
  requestId: "request_b",
};

test("final API persistence foundation writes ingest aggregate in one transaction boundary", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const result = await runtime.ingestService.ingest(businessFoundationSeedFixture);
  const expectedRows = businessFoundationSeedFixture.rows.length;

  assert.equal(result.summaries.length, expectedRows);
  assert.equal(result.snapshots.length, expectedRows);
  assert.equal(result.diagnoses.length, expectedRows);
  assert.match(result.workflowRunId, /^workflow_/);
  assert.equal(runtime.store.profilesById.size, expectedRows);
  assert.equal(runtime.store.snapshots.size, expectedRows);
  assert.equal(runtime.store.diagnoses.size, expectedRows);
  assert.equal(runtime.store.projections.size, expectedRows);
  assert.equal(runtime.store.workflowAudits.size, 1);

  const summary = await runtime.ingestService.getHealthSummary();
  assert.equal(summary.total, expectedRows);
  assert.equal((await runtime.ingestService.listSkus()).items.length, expectedRows);
  assert.equal((await runtime.ingestService.getSkuDetail(result.summaries[0].skuProfileId))?.latestSnapshot?.skuProfileId, result.summaries[0].skuProfileId);
});

test("final API repositories carry tenant and session boundary and deny cross-tenant access", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingestA = await runtime.ingestService.ingest(businessFoundationSeedFixture, tenantA);

  assert.equal((await runtime.ingestService.getHealthSummary(tenantA)).total, businessFoundationSeedFixture.rows.length);
  assert.equal((await runtime.ingestService.getHealthSummary(tenantB)).total, 0);
  await assert.rejects(
    () => runtime.ingestService.getSkuDetail(ingestA.summaries[0].skuProfileId, tenantB),
    (error) => error instanceof P0AuthBoundaryError && error.code === "P0_TENANT_BOUNDARY_DENIED",
  );

  const ruleSet = await runtime.activityService.parse(
    {
      name: "Tenant A 规则",
      platform: "tmall",
      sourceText: businessFoundationActivityRuleText,
    },
    tenantA,
  );

  await assert.rejects(
    () => runtime.activityService.simulate(ruleSet.ruleSetId, { skuProfileIds: [ingestA.summaries[0].skuProfileId] }, tenantB),
    (error) => error instanceof P0AuthBoundaryError && error.code === "P0_TENANT_BOUNDARY_DENIED",
  );
});

test("sku readiness query exposes browser collection key metrics", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = await runtime.ingestService.ingest({
    connectorId: "doudian-browser-extension",
    collectedAt: "2026-05-24T10:00:00.000Z",
    rows: [
      {
        platform: "doudian",
        storeId: "fxg.jinritemai.com",
        externalSkuId: "3818388858177978472",
        productName: "韩版夏季短袖上衣",
        stock: 98,
        raw: {
          extensionSourceKind: "current-page-dom",
          domMetrics: {
            salesCount: 4,
            positiveRate: 1,
            qualityScore: 85,
            qualityLabel: "优秀",
          },
        },
      },
    ],
  });

  const list = await runtime.skuReadinessQueryService.list({ page: 1, pageSize: 10 }, {
    actorId: "dev_actor",
    tenantId: "dev_tenant",
    sessionId: "dev_session",
    surface: "api-test",
    requestId: "request_dev",
  });
  const item = list.items.find((row) => row.skuProfileId === ingest.summaries[0].skuProfileId);
  assert.equal(item?.sales30d, 4);
  assert.equal(item?.positiveRate, 1);
  assert.equal(item?.qualityScore, 85);
  assert.equal(item?.sourceKind, "current-page-dom");

  const detail = await runtime.skuReadinessQueryService.detail(ingest.summaries[0].skuProfileId, {
    actorId: "dev_actor",
    tenantId: "dev_tenant",
    sessionId: "dev_session",
    surface: "api-test",
    requestId: "request_dev",
  });
  assert.equal(detail?.keyMetrics.qualityLabel, "优秀");
  assert.equal(detail?.keyMetrics.collectedAt, "2026-05-24T10:00:00.000Z");
});

test("sku readiness query supports fuzzy, multi-value and range filters for agent search", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  await runtime.ingestService.ingest({
    connectorId: "doudian-browser-extension",
    collectedAt: "2026-05-24T10:00:00.000Z",
    rows: [
      {
        platform: "doudian",
        storeId: "fxg.jinritemai.com",
        externalSkuId: "3818388858177978472",
        productName: "韩版夏季短袖上衣",
        category: "女装",
        stock: 98,
        raw: {
          extensionSourceKind: "current-page-dom",
          domMetrics: { salesCount: 4, positiveRate: 1, qualityScore: 85, qualityLabel: "优秀" },
        },
      },
      {
        platform: "tmall",
        storeId: "flagship",
        externalSkuId: "SKU-LOW",
        productName: "低库存测试商品",
        category: "配饰",
        stock: 3,
        sales30d: 100,
        positiveRate: 0.8,
        raw: {},
      },
    ],
  });

  const boundary = {
    actorId: "dev_actor",
    tenantId: "dev_tenant",
    sessionId: "dev_session",
    surface: "api-test",
    requestId: "request_dev",
  };
  const fuzzy = await runtime.skuReadinessQueryService.list({ q: "短袖", platforms: ["doudian", "jd"], categories: ["女装"], minQualityScore: 80, minPositiveRate: 0.95 }, boundary);
  assert.equal(fuzzy.total, 1);
  assert.equal(fuzzy.items[0]?.qualityLabel, "优秀");

  const lowStock = await runtime.skuReadinessQueryService.list({ maxStock: 5, maxPositiveRate: 0.9, productName: "测试", sortBy: "stock", sortOrder: "asc" }, boundary);
  assert.equal(lowStock.total, 1);
  assert.equal(lowStock.items[0]?.stock, 3);

  const byTime = await runtime.skuReadinessQueryService.list({ collectedAtFrom: "2026-05-24T00:00:00.000Z", collectedAtTo: "2026-05-24T23:59:59.000Z", sourceKinds: ["current-page-dom"] }, boundary);
  assert.equal(byTime.total, 1);
  assert.equal(byTime.items[0]?.sourceKind, "current-page-dom");
});

test("final activity, review and report services share persistent repositories", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture);
  const ruleSet = await runtime.activityService.parse({
    name: "618 活动准入规则",
    platform: "tmall",
    sourceText: businessFoundationActivityRuleText,
  });

  const run = await runtime.activityService.simulate(ruleSet.ruleSetId, {
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
  });

  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.results.length, businessFoundationSeedFixture.rows.length);
  assert.equal(runtime.store.ruleSets.get(ruleSet.ruleSetId)?.ruleSetId, ruleSet.ruleSetId);
  assert.equal(runtime.store.simulationRuns.get(run.simulationRunId)?.results.length, businessFoundationSeedFixture.rows.length);
  assert.equal(runtime.store.simulationResults.size, businessFoundationSeedFixture.rows.length);

  const reviews = await runtime.reviewService.create([
    {
      skuProfileId: ingest.summaries[1].skuProfileId,
      sourceType: "simulation",
      sourceId: run.results[1].simulationResultId,
      question: "是否允许库存不足 SKU 进入活动准备？",
      recommendation: "先补货后重跑模拟",
      riskLevel: "L1",
      evidence: run.results[1].evidence,
    },
  ]);
  const review = reviews[0];
  assert.equal((await runtime.reviewService.list()).total, 1);
  assert.equal((await runtime.reviewService.decide(review.reviewItemId, { decision: "REQUEST_CHANGES", decisionBy: "ops@example.test" })).status, "MODIFIED");

  const report = await runtime.reportService.generate({
    type: "ACTIVITY",
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
    simulationResultIds: run.results.map((item) => item.simulationResultId),
  });
  assert.equal(report.status, "PREVIEW");
  assert.equal(runtime.store.reports.get(report.reportId)?.reportId, report.reportId);
  assert.ok(report.evidenceSummary.length > 0);
});

test("review decisions cannot be overwritten after the item leaves pending state", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const [review] = await runtime.reviewService.create(
    [
      {
        sourceType: "agent",
        sourceId: "agent_run_closed_review",
        question: "是否批准 Agent 建议？",
        recommendation: "先批准一次，后续重复决策应被拒绝。",
        riskLevel: "L1",
        evidence: [],
      },
    ],
    tenantA,
  );
  assert.ok(review);

  await runtime.reviewService.decide(review.reviewItemId, { decision: "APPROVE", decisionBy: "ops@example.test" }, tenantA);
  await assert.rejects(
    async () => runtime.reviewService.decide(review.reviewItemId, { decision: "REJECT", decisionBy: "ops@example.test" }, tenantA),
    /Review item is not pending:/,
  );
});

test("prisma report repository reads detail from latest version snapshot", async () => {
  const reportRow = {
    id: "report_1",
    title: "报告主表标题",
    status: "PREVIEW",
    latestVersionId: "version_uuid_1",
    subscriptionJson: {},
    summaryJson: { totalSku: 0 },
    createdAt: new Date("2026-05-24T00:00:00.000Z"),
  };
  const versionDetail = {
    reportId: "report_1",
    title: "报告版本标题",
    version: "v1",
    status: "PREVIEW" as const,
    generatedAt: "2026-05-24T00:00:00.000Z",
    tabs: ["SUMMARY" as const],
    summary: {
      totalSku: 3,
      passedSku: 1,
      repairableSku: 1,
      blockedSku: 1,
      categoryDistribution: [],
      majorRisks: [],
      repairSuggestions: [],
      reviewResult: { total: 0, completed: 0, approved: 0, rejected: 0 },
    },
    evidenceSummary: [],
  };
  const versionRow = {
    id: "version_uuid_1",
    reportId: "report_1",
    version: 1,
    status: "PREVIEW",
    sectionsJson: versionDetail,
    evidenceRefsJson: [],
    createdAt: new Date("2026-05-24T00:00:00.000Z"),
  };
  const repository = new PrismaReportRepository({
    report: {
      findMany: async () => [reportRow],
      findUnique: async () => reportRow,
    },
    reportVersion: {
      findUnique: async () => versionRow,
      findFirst: async () => versionRow,
      findMany: async () => [versionRow],
    },
  } as never);

  const list = await repository.list(tenantA);
  const detail = await repository.getById(tenantA, "report_1");

  assert.equal(list[0]?.version, "v1");
  assert.equal(list[0]?.summary.totalSku, 3);
  assert.equal(detail?.version, "v1");
  assert.equal(detail?.summary.totalSku, 3);
});

test("prisma review repository records create audit history", async () => {
  const workflowRuns: Array<Record<string, unknown>> = [];
  const reviewRow = {
    id: "review_1",
    skuProfileId: "sku_1",
    simulationResultId: null,
    diagnosisId: null,
    snapshotId: null,
    reviewType: "health",
    status: "PENDING",
    question: "是否提交人工确认？",
    agentRecommendation: "提交人工确认",
    riskLevel: "L1",
    evidenceJson: [],
  };
  const repository = new PrismaReviewRepository({
    reviewItem: {
      create: async () => reviewRow,
      findMany: async () => [reviewRow],
      findUnique: async () => reviewRow,
    },
    workflowRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        workflowRuns.push(data);
        return data;
      },
      findMany: async () => workflowRuns.map((item) => ({ ...item, startedAt: new Date("2026-05-24T00:00:00.000Z") })),
    },
  } as never);

  const created = await repository.create(tenantA, [
    {
      skuProfileId: "sku_1",
      sourceType: "health",
      sourceId: "sku_1",
      question: "是否提交人工确认？",
      recommendation: "提交人工确认",
      riskLevel: "L1",
      evidence: [],
    },
  ]);
  const history = await repository.approvalHistory(tenantA, created[0].reviewItemId);

  assert.equal(created[0].status, "OPEN");
  assert.equal(workflowRuns[0]?.workflowType, "review_create");
  assert.equal((workflowRuns[0]?.inputJson as { actorId?: string }).actorId, tenantA.actorId);
  assert.equal(history[0]?.action, "review_create");
  assert.equal(history[0]?.actor, tenantA.actorId);
});

test("prisma review decision rejects closed item before writes", async () => {
  const writes: string[] = [];
  const repository = new PrismaReviewRepository({
    reviewItem: {
      findUnique: async () => ({
        id: "review_closed",
        reviewType: "agent",
        status: "APPROVED",
        question: "已批准项",
        agentRecommendation: "不应重复审批",
        riskLevel: "L1",
        evidenceJson: [],
      }),
      update: async () => {
        writes.push("reviewItem.update");
        return {};
      },
    },
    workflowRun: {
      create: async () => {
        writes.push("workflowRun.create");
        return {};
      },
    },
  } as never);

  await assert.rejects(
    () => repository.decide(tenantA, "review_closed", { decision: "REJECT", decisionBy: "ops@example.test" }),
    /Review item is not pending: review_closed/,
  );
  assert.deepEqual(writes, []);
});

test("dashboard SKU read models expose filterable list and evidence-backed detail", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture);
  const ruleSet = await runtime.activityService.parse({
    name: "618 活动准入规则",
    platform: "tmall",
    sourceText: businessFoundationActivityRuleText,
  });
  await runtime.activityService.simulate(ruleSet.ruleSetId, {
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
  });

  const list = await runtime.skuReadinessQueryService.list({ page: 1, pageSize: 10, platform: "tmall", sortBy: "updatedAt", sortOrder: "desc" }, tenantA);
  assert.equal(list.total, 0, "explicit auth boundary must not fall back to dev tenant");

  const devList = await runtime.skuReadinessQueryService.list({ page: 1, pageSize: 10, eligibilityStatus: "DIRECT_READY" }, {
    actorId: "dev_actor",
    tenantId: "dev_tenant",
    sessionId: "dev_session",
    surface: "api-test",
    requestId: "request_dev",
  });
  assert.ok(devList.total >= 1);
  assert.ok(devList.items.every((item) => item.nextAction.type === "JOIN_ACTIVITY"));
  assert.ok(devList.items.every((item) => item.evidenceCount > 0));

  const detail = await runtime.skuReadinessQueryService.detail(devList.items[0].skuProfileId, {
    actorId: "dev_actor",
    tenantId: "dev_tenant",
    sessionId: "dev_session",
    surface: "api-test",
    requestId: "request_dev",
  });
  assert.ok(detail);
  assert.ok(detail.readinessChecklist.every((item) => item.evidenceRefs.length > 0));
  assert.ok(detail.relatedRules.length > 0);
});

test("sku next action updates return and read back the same persisted action", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture);
  const skuProfileId = ingest.summaries[0].skuProfileId;
  const boundary = {
    actorId: "dev_actor",
    tenantId: "dev_tenant",
    sessionId: "dev_session",
    surface: "api-test",
    requestId: "request_dev",
  };
  const nextAction = { type: "MANUAL_REVIEW" as const, label: "提交人工确认" };

  const updated = await runtime.skuReadinessQueryService.updateNextAction(skuProfileId, { nextAction, comment: "unit-test" }, boundary);
  assert.equal(updated.statusSummary.nextStep, nextAction.label);

  const detail = await runtime.skuReadinessQueryService.detail(skuProfileId, boundary);
  assert.equal(detail?.statusSummary.nextStep, nextAction.label);

  const list = await runtime.skuReadinessQueryService.list({ page: 1, pageSize: 10 }, boundary);
  assert.deepEqual(list.items.find((item) => item.skuProfileId === skuProfileId)?.nextAction, nextAction);
  assert.ok(Array.from(runtime.store.workflowAudits.values()).some((audit) => audit.workflowType === "sku_next_action_update" && audit.subjectId === skuProfileId && audit.input.actorId === boundary.actorId));
});

test("prisma dashboard sku read model reads latest persisted next action after refresh", async () => {
  const workflowRuns: Array<Record<string, unknown>> = [];
  const projectionRow = {
    skuProfileId: "sku_prisma_next",
    skuProfile: {
      canonicalKey: "tmall:store:sku_prisma_next",
      productName: "持久化下一步测试 SKU",
      platform: "tmall",
      storeId: "store",
    },
    healthStatus: "READY",
    healthScore: 92,
    dataQualityScore: 0.98,
    topIssuesJson: [],
    latestSnapshot: null,
    latestDiagnosis: null,
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  };
  const repository = new PrismaDashboardSkuReadModelRepository({
    currentSkuProjection: {
      findUnique: async () => projectionRow,
      findMany: async () => [projectionRow],
    },
    activitySimulationResult: {
      findMany: async () => [],
    },
    reviewItem: {
      findMany: async () => [],
    },
    workflowRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        workflowRuns.push(data);
        return data;
      },
      findFirst: async () => workflowRuns.at(-1) ?? null,
    },
  } as never);
  const nextAction = { type: "MANUAL_REVIEW" as const, label: "提交人工确认" };

  const updated = await repository.updateNextAction(tenantA, "sku_prisma_next", { nextAction, comment: "unit-test" });
  const detail = await repository.detail(tenantA, "sku_prisma_next");
  const list = await repository.list(tenantA);

  assert.deepEqual(updated.nextActionOverride, nextAction);
  assert.equal(detail?.nextActionOverride?.type, nextAction.type);
  assert.equal(detail?.nextActionOverride?.label, nextAction.label);
  assert.equal(list[0]?.nextActionOverride?.type, nextAction.type);
  assert.equal(list[0]?.nextActionOverride?.label, nextAction.label);
  assert.equal(workflowRuns[0]?.workflowType, "sku_next_action_update");
  assert.equal(workflowRuns[0]?.subjectId, "sku_prisma_next");
});

test("rule library service exposes detail, versions, status updates and workflow audits", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const created = await runtime.ruleSetService.create(
    {
      name: "规则库验收规则",
      platform: "tmall",
      sourceText: "活动库存不得低于 50 件，好评率不少于 95%，证书必须有效，人工确认特殊资质。",
      source: "INTERNAL",
    },
    tenantA,
  );

  assert.equal(created.status, "DRAFT");
  assert.equal(created.dslJson.length, 4);
  assert.ok(created.affectedFields.some((field) => field.field === "stock" && field.dataSources.length > 0));
  assert.ok(created.manualReviewItems.length > 0);

  const list = await runtime.ruleSetService.list(1, 20, tenantA);
  assert.equal(list.total, 1);
  assert.equal(list.items[0].ruleSetId, created.ruleSetId);

  const version = await runtime.ruleSetService.createVersion(created.ruleSetId, tenantA);
  assert.equal(version.version, "v2");
  assert.equal((await runtime.ruleSetService.listVersions(created.ruleSetId, tenantA)).length, 2);

  const updated = await runtime.ruleSetService.update(created.ruleSetId, { name: "规则库验收规则 v2", status: "ENABLED" }, tenantA);
  assert.equal(updated.name, "规则库验收规则 v2");
  assert.equal(updated.status, "ENABLED");

  const enabled = await runtime.ruleSetService.setStatus(created.ruleSetId, "ENABLED", tenantA);
  assert.equal(enabled.status, "ENABLED");
  assert.ok(Array.from(runtime.store.workflowAudits.values()).some((audit) => audit.workflowType === "rule_set_status_update" && audit.subjectId === created.ruleSetId));

  await assert.rejects(
    () => runtime.ruleSetService.get(created.ruleSetId, tenantB),
    (error) => error instanceof P0AuthBoundaryError && error.code === "P0_TENANT_BOUNDARY_DENIED",
  );
});

test("disabled rule sets cannot be used for simulations", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture, tenantA);
  const created = await runtime.ruleSetService.create(
    {
      name: "禁用规则集模拟保护",
      platform: "tmall",
      sourceText: "活动库存不得低于 50 件，好评率不少于 95%。",
      source: "INTERNAL",
      status: "ENABLED",
    },
    tenantA,
  );
  await runtime.ruleSetService.setStatus(created.ruleSetId, "DISABLED", tenantA);

  await assert.rejects(
    () => runtime.activityService.simulate(created.ruleSetId, { skuProfileIds: [ingest.summaries[0].skuProfileId] }, tenantA),
    /Rule set is disabled:/,
  );
});

test("prisma activity simulation rejects disabled rule set before writing run", async () => {
  const writes: string[] = [];
  const repository = new PrismaActivityRepository({
    activityRuleSet: {
      findUnique: async () => ({
        id: "rule_disabled",
        name: "禁用规则",
        platform: "tmall",
        sourceText: "库存 >= 50",
        rulesJson: [],
        parseStatus: "parsed",
        parseConfidence: 0.9,
        parseMetadataJson: { status: "DISABLED" },
      }),
    },
    activitySimulationRun: {
      create: async () => {
        writes.push("activitySimulationRun.create");
        return {};
      },
    },
    activitySimulationResult: {
      create: async () => {
        writes.push("activitySimulationResult.create");
        return {};
      },
    },
  } as never);
  const service = new FinalActivityService(
    repository,
    {
      detail: async () => ({
        skuProfileId: "sku_1",
        latestSnapshot: {
          snapshotId: "snapshot_1",
          skuProfileId: "sku_1",
          collectedAt: new Date().toISOString(),
          source: "unit-test",
          stock: 10,
          positiveRate: 0.9,
          sales30d: 1,
          certificateStatus: "valid",
          raw: {},
        },
      }),
    } as never,
  );

  await assert.rejects(
    () => service.simulate("rule_disabled", { skuProfileIds: ["sku_1"] }, tenantA),
    /Rule set is disabled: rule_disabled/,
  );
  assert.deepEqual(writes, []);
});

test("rule set source text updates reparse rules even when stale rules are submitted", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const created = await runtime.ruleSetService.create(
    {
      name: "规则编辑重解析",
      platform: "tmall",
      sourceText: "活动库存不得低于 50 件",
      source: "INTERNAL",
    },
    tenantA,
  );

  const updated = await runtime.ruleSetService.update(
    created.ruleSetId,
    {
      sourceText: "活动库存不得低于 200 件，好评率不少于 98%",
      rules: created.dslJson,
    },
    tenantA,
  );

  assert.ok(updated.dslJson.some((rule) => rule.id === "stock_min" && rule.value === 200));
  assert.ok(updated.dslJson.some((rule) => rule.id === "positive_rate" && rule.value === 0.98));
});

test("workspace settings service keeps L3 runtime tools denied", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const policy = await runtime.workspaceSettingsService.updateToolPolicy(
    {
      allowedAgentTools: ["getSkuSummary", "bash", "runtime:exec"],
      deniedRuntimeTools: ["customDangerousTool"],
    },
    tenantA,
  );

  assert.deepEqual(policy.allowedAgentTools, ["getSkuSummary"]);
  assert.ok(policy.deniedRuntimeTools.includes("bash"));
  assert.ok(policy.deniedRuntimeTools.includes("runtime:exec"));
  assert.ok(policy.deniedRuntimeTools.includes("customDangerousTool"));

  const workspace = await runtime.workspaceSettingsService.updateWorkspace({ dataFreshnessThresholdHours: 12, reviewSlaHours: { high: 2, medium: 8, low: 48 } }, tenantA);
  assert.equal(workspace.dataFreshnessThresholdHours, 12);
  assert.equal(workspace.reviewSlaHours.high, 2);
  assert.equal((await runtime.workspaceSettingsService.listUsers(tenantA)).length, 3);
  assert.ok(Array.from(runtime.store.workflowAudits.values()).some((audit) => audit.workflowType === "tool_policy_update"));
});

test("workspace settings and tool policy read back memory updates", async () => {
  const runtime = createFinalApiPersistenceRuntime();

  await runtime.workspaceSettingsService.updateWorkspace({ dataFreshnessThresholdHours: 6 }, tenantA);
  await runtime.workspaceSettingsService.updateToolPolicy({ allowedAgentTools: [], deniedRuntimeTools: ["customDenied"] }, tenantA);

  const workspace = await runtime.workspaceSettingsService.getWorkspace(tenantA);
  const policy = await runtime.workspaceSettingsService.getToolPolicy(tenantA);

  assert.equal(workspace.dataFreshnessThresholdHours, 6);
  assert.deepEqual(policy.allowedAgentTools, []);
  assert.ok(policy.deniedRuntimeTools.includes("customDenied"));
  assert.ok(policy.deniedRuntimeTools.includes("bash"));
});

test("connector sync run normalizes fractional quality scores for persistence", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const connector = await runtime.connectorService.create(
    {
      code: "quality_score_connector",
      name: "质量分连接器",
      kind: "platform_api",
      platform: "tmall",
      status: "ACTIVE",
      config: { source: "unit-test" },
    },
    tenantA,
  );

  const run = await runtime.connectorService.createSyncRun(connector.connectorId, { rowCount: 10, qualityScore: 0.9 }, tenantA);
  assert.equal(run.qualityScore, 90);

  const runs = await runtime.connectorService.listRuns(connector.connectorId, 1, 10, tenantA);
  assert.equal(runs.items[0]?.qualityScore, 90);

  const detail = await runtime.connectorService.getRun(run.connectorRunId, tenantA);
  assert.equal(detail?.qualityScore, 90);
});

test("connector create and status updates are visible in workflow audits", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const connector = await runtime.connectorService.create(
    {
      code: "audit_connector",
      name: "审计连接器",
      kind: "platform_api",
      platform: "tmall",
      status: "ACTIVE",
      config: { source: "unit-test" },
    },
    tenantA,
  );

  const disabled = await runtime.connectorService.update(connector.connectorId, { status: "DISABLED" }, tenantA);
  const audits = await runtime.workflowAuditService.list(tenantA, 20);

  assert.equal(disabled.status, "DISABLED");
  assert.ok(audits.some((audit) => audit.workflowType === "connector_create" && audit.subjectId === connector.connectorId && audit.input.actorId === tenantA.actorId));
  assert.ok(audits.some((audit) => audit.workflowType === "connector_update" && audit.subjectId === connector.connectorId && audit.output.status === "DISABLED"));
});

test("disabled connectors cannot create sync runs", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const connector = await runtime.connectorService.create(
    {
      code: "disabled_run_connector",
      name: "停用运行连接器",
      kind: "platform_api",
      platform: "tmall",
      status: "DISABLED",
      config: { source: "unit-test" },
    },
    tenantA,
  );

  await assert.rejects(
    async () => runtime.connectorService.createSyncRun(connector.connectorId, { rowCount: 1, qualityScore: 0.9 }, tenantA),
    /Connector is disabled:/,
  );
});

test("prisma connector run validates connector before writing workflow audit", async () => {
  const writes: string[] = [];
  const repository = new PrismaConnectorRepositoryV2({
    connector: {
      findUnique: async () => null,
    },
    workflowRun: {
      create: async () => {
        writes.push("workflowRun");
        return {};
      },
    },
    connectorRun: {
      create: async () => {
        writes.push("connectorRun");
        return {};
      },
    },
  } as never);

  await assert.rejects(
    () => repository.createRun(tenantA, "missing_connector", { rowCount: 1, qualityScore: 0.9 }),
    /Connector not found: missing_connector/,
  );
  assert.deepEqual(writes, []);
});

test("prisma connector run rejects disabled connector before writing workflow audit", async () => {
  const writes: string[] = [];
  const repository = new PrismaConnectorRepositoryV2({
    connector: {
      findUnique: async () => ({ id: "disabled_connector", code: "disabled_connector", name: "停用连接器", kind: "platform_api", configJson: {}, status: "disabled", createdAt: new Date(), updatedAt: new Date() }),
    },
    workflowRun: {
      create: async () => {
        writes.push("workflowRun");
        return {};
      },
    },
    connectorRun: {
      create: async () => {
        writes.push("connectorRun");
        return {};
      },
    },
  } as never);

  await assert.rejects(
    () => repository.createRun(tenantA, "disabled_connector", { rowCount: 1, qualityScore: 0.9 }),
    /Connector is disabled: disabled_connector/,
  );
  assert.deepEqual(writes, []);
});

test("workflow audit query service reads prisma workflow runs for run console", async () => {
  const service = new WorkflowAuditQueryService({
    prisma: {
      workflowRun: {
        findMany: async (args: Record<string, unknown>) => {
          assert.deepEqual(args, { orderBy: { startedAt: "desc" }, take: 50 });
          return [
            {
              id: "workflow_prisma_1",
              workflowType: "report_export",
              status: "SUCCEEDED",
              subjectType: "report",
              subjectId: "report_1",
              inputJson: { format: "PDF" },
              outputJson: { exportJobId: "export_1" },
              startedAt: new Date("2026-05-24T10:00:00.000Z"),
            },
          ];
        },
      },
    } as never,
  });

  const audits = await service.list(tenantA, 50);

  assert.equal(audits[0]?.workflowRunId, "workflow_prisma_1");
  assert.equal(audits[0]?.workflowType, "report_export");
  assert.deepEqual(audits[0]?.input, { format: "PDF" });
  assert.deepEqual(audits[0]?.output, { exportJobId: "export_1" });
  assert.equal(audits[0]?.createdAt, "2026-05-24T10:00:00.000Z");
});
