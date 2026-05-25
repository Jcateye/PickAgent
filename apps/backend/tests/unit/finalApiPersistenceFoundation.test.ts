import assert from "node:assert/strict";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { createFinalApiPersistenceRuntime } from "../../src/application/foundation/FinalApiPersistenceFoundation";
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

  const enabled = await runtime.ruleSetService.setStatus(created.ruleSetId, "ENABLED", tenantA);
  assert.equal(enabled.status, "ENABLED");
  assert.ok(Array.from(runtime.store.workflowAudits.values()).some((audit) => audit.workflowType === "rule_set_status_update" && audit.subjectId === created.ruleSetId));

  await assert.rejects(
    () => runtime.ruleSetService.get(created.ruleSetId, tenantB),
    (error) => error instanceof P0AuthBoundaryError && error.code === "P0_TENANT_BOUNDARY_DENIED",
  );
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
