import assert from "node:assert/strict";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { createBusinessFoundationRuntime } from "../../src/application/foundation/BusinessFoundationServices";

test("backend business foundation supports ingest, projection, simulation, review, report and agent tools", () => {
  const runtime = createBusinessFoundationRuntime();

  const ingestResult = runtime.ingestService.ingest(businessFoundationSeedFixture);
  assert.equal(ingestResult.summaries.length, 2);

  const summary = runtime.skuQueryService.getHealthSummary();
  assert.equal(summary.total, 2);

  const ruleSet = runtime.activityRuleService.parseRules({
    name: "618 活动准入规则",
    platform: "tmall",
    sourceText: businessFoundationActivityRuleText,
  });
  assert.equal(ruleSet.parseStatus, "PARSED");

  const simulation = runtime.activitySimulationService.runSimulation({
    ruleSetId: ruleSet.ruleSetId,
    skuProfileIds: ingestResult.summaries.map((item) => item.skuProfileId),
  });
  assert.equal(simulation.length, 2);
  assert.equal(simulation[0]?.eligibility, "DIRECT_READY");

  const reviews = runtime.reviewService.createReviewItems([
    {
      skuProfileId: ingestResult.summaries[1]?.skuProfileId,
      sourceType: "simulation",
      sourceId: simulation[1]?.simulationResultId ?? "simulation_missing",
      question: "是否允许库存不足 SKU 进入活动准备？",
      recommendation: "先补货后重跑模拟",
      riskLevel: "L1",
      evidence: simulation[1]?.evidence ?? [],
    },
  ]);
  assert.equal(reviews[0]?.status, "OPEN");
  assert.equal(runtime.reviewService.decide(reviews[0].reviewItemId, "REQUEST_CHANGES", "ops@example.test").status, "CHANGES_REQUESTED");

  const report = runtime.reportService.generatePreview({
    type: "ACTIVITY",
    skuProfileIds: ingestResult.summaries.map((item) => item.skuProfileId),
    simulationResultIds: simulation.map((item) => item.simulationResultId),
  });
  assert.equal(report.status, "PREVIEW");

  const tools = runtime.agentToolRegistry.listTools();
  assert.equal(tools.length, 5);
  const toolResult = runtime.agentToolRegistry.execute("getSkuSummary", { skuProfileId: ingestResult.summaries[0]?.skuProfileId });
  assert.equal(toolResult.status, "SUCCEEDED");
});
