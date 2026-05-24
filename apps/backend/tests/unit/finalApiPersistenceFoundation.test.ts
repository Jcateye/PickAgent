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

  assert.equal(result.summaries.length, 2);
  assert.equal(result.snapshots.length, 2);
  assert.equal(result.diagnoses.length, 2);
  assert.match(result.workflowRunId, /^workflow_/);
  assert.equal(runtime.store.profilesById.size, 2);
  assert.equal(runtime.store.snapshots.size, 2);
  assert.equal(runtime.store.diagnoses.size, 2);
  assert.equal(runtime.store.projections.size, 2);
  assert.equal(runtime.store.workflowAudits.size, 1);

  const summary = await runtime.ingestService.getHealthSummary();
  assert.equal(summary.total, 2);
  assert.equal((await runtime.ingestService.listSkus()).items.length, 2);
  assert.equal((await runtime.ingestService.getSkuDetail(result.summaries[0].skuProfileId))?.latestSnapshot?.skuProfileId, result.summaries[0].skuProfileId);
});

test("final API repositories carry tenant and session boundary and deny cross-tenant access", async () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingestA = await runtime.ingestService.ingest(businessFoundationSeedFixture, tenantA);

  assert.equal((await runtime.ingestService.getHealthSummary(tenantA)).total, 2);
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
  assert.equal(run.results.length, 2);
  assert.equal(runtime.store.ruleSets.get(ruleSet.ruleSetId)?.ruleSetId, ruleSet.ruleSetId);
  assert.equal(runtime.store.simulationRuns.get(run.simulationRunId)?.results.length, 2);
  assert.equal(runtime.store.simulationResults.size, 2);

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
