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
  assert.equal((await runtime.reviewService.decide(review.reviewItemId, { decision: "REQUEST_CHANGES", decisionBy: "ops@example.test" })).status, "CHANGES_REQUESTED");

  const report = await runtime.reportService.generate({
    type: "ACTIVITY",
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
    simulationResultIds: run.results.map((item) => item.simulationResultId),
  });
  assert.equal(report.status, "PREVIEW");
  assert.equal(runtime.store.reports.get(report.reportId)?.reportId, report.reportId);
  assert.ok(report.evidenceSummary.length > 0);
});
