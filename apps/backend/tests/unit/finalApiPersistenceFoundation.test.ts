import assert from "node:assert/strict";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { createFinalApiPersistenceRuntime } from "../../src/application/foundation/FinalApiPersistenceFoundation";

test("final API persistence foundation writes ingest aggregate in one transaction boundary", () => {
  const runtime = createFinalApiPersistenceRuntime();
  const result = runtime.ingestService.ingest(businessFoundationSeedFixture);

  assert.equal(result.summaries.length, 2);
  assert.equal(result.snapshots.length, 2);
  assert.equal(result.diagnoses.length, 2);
  assert.match(result.workflowRunId, /^workflow_/);
  assert.equal(runtime.store.profilesById.size, 2);
  assert.equal(runtime.store.snapshots.size, 2);
  assert.equal(runtime.store.diagnoses.size, 2);
  assert.equal(runtime.store.projections.size, 2);
  assert.equal(runtime.store.workflowAudits.size, 1);

  const summary = runtime.ingestService.getHealthSummary();
  assert.equal(summary.total, 2);
  assert.equal(runtime.ingestService.listSkus().items.length, 2);
  assert.equal(runtime.ingestService.getSkuDetail(result.summaries[0].skuProfileId)?.latestSnapshot?.skuProfileId, result.summaries[0].skuProfileId);
});

test("final activity, review and report services share persistent repositories", () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = runtime.ingestService.ingest(businessFoundationSeedFixture);
  const ruleSet = runtime.activityService.parse({
    name: "618 活动准入规则",
    platform: "tmall",
    sourceText: businessFoundationActivityRuleText,
  });

  const run = runtime.activityService.simulate(ruleSet.ruleSetId, {
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
  });

  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.results.length, 2);
  assert.equal(runtime.store.ruleSets.get(ruleSet.ruleSetId)?.ruleSetId, ruleSet.ruleSetId);
  assert.equal(runtime.store.simulationRuns.get(run.simulationRunId)?.results.length, 2);
  assert.equal(runtime.store.simulationResults.size, 2);

  const review = runtime.reviewService.create([
    {
      skuProfileId: ingest.summaries[1].skuProfileId,
      sourceType: "simulation",
      sourceId: run.results[1].simulationResultId,
      question: "是否允许库存不足 SKU 进入活动准备？",
      recommendation: "先补货后重跑模拟",
      riskLevel: "L1",
      evidence: run.results[1].evidence,
    },
  ])[0];
  assert.equal(runtime.reviewService.list().total, 1);
  assert.equal(runtime.reviewService.decide(review.reviewItemId, { decision: "REQUEST_CHANGES", decisionBy: "ops@example.test" }).status, "CHANGES_REQUESTED");

  const report = runtime.reportService.generate({
    type: "ACTIVITY",
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
    simulationResultIds: run.results.map((item) => item.simulationResultId),
  });
  assert.equal(report.status, "PREVIEW");
  assert.equal(runtime.store.reports.get(report.reportId)?.reportId, report.reportId);
  assert.ok(report.evidenceSummary.length > 0);
});
