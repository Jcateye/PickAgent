import assert from "node:assert/strict";
import test from "node:test";
import { businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { createFinalApiPersistenceRuntime } from "../../src/application/foundation/FinalApiPersistenceFoundation";

test("final activity simulation closure links parse, simulation, review and report preflight", () => {
  const runtime = createFinalApiPersistenceRuntime();
  const ingest = runtime.ingestService.ingest(businessFoundationSeedFixture);

  const ruleSet = runtime.activityService.parse({
    name: "Layer 4B 活动模拟收口规则",
    platform: "workbench",
    sourceText: "活动库存不得低于 80 件，证书状态必须有效，人工确认互斥活动。",
  });

  assert.match(ruleSet.ruleSetId, /^rules_/);
  assert.equal(ruleSet.parseStatus, "NEEDS_REVIEW");
  assert.ok(ruleSet.confidence > 0);
  assert.equal(runtime.store.ruleSets.get(ruleSet.ruleSetId)?.ruleSetId, ruleSet.ruleSetId);

  const simulation = runtime.activityService.simulate(ruleSet.ruleSetId, {
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
  });

  assert.equal(simulation.status, "SUCCEEDED");
  assert.equal(simulation.activityRuleSetId, ruleSet.ruleSetId);
  assert.ok(simulation.results.some((item) => item.eligibility === "MANUAL_REVIEW"));
  assert.ok(simulation.results.every((item) => item.evidence.some((evidence) => evidence.type === "rule" && evidence.entityId === ruleSet.ruleSetId)));
  assert.ok(simulation.results.every((item) => runtime.store.simulationResults.has(item.simulationResultId)));

  const whatIf = runtime.activityService.simulate(ruleSet.ruleSetId, {
    skuProfileIds: [ingest.summaries[1].skuProfileId],
    whatIf: { stock: 120 },
  });
  assert.equal(whatIf.results.length, 1);
  assert.ok(whatIf.results[0].originalEligibility);

  const reviewCandidates = simulation.results.filter((item) => item.eligibility === "MANUAL_REVIEW" || item.eligibility === "BLOCKED");
  const reviews = runtime.reviewService.create(
    reviewCandidates.map((item) => ({
      skuProfileId: item.skuProfileId,
      sourceType: "simulation" as const,
      sourceId: item.simulationResultId,
      question: "活动模拟 MANUAL_REVIEW 是否允许继续推进？",
      recommendation: "先由 Review 工作台确认活动上下文，再重跑模拟。",
      riskLevel: "L2" as const,
      evidence: item.evidence,
    })),
  );

  assert.ok(reviews.length > 0);
  assert.ok(reviews.every((item) => item.status === "OPEN"));
  assert.ok(reviews.every((item) => item.sourceType === "simulation"));

  const report = runtime.reportService.generate({
    type: "ACTIVITY",
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
    simulationResultIds: simulation.results.map((item) => item.simulationResultId),
  });

  assert.equal(report.status, "PREVIEW");
  assert.ok(report.evidenceSummary.some((evidence) => evidence.type === "simulation"));
  assert.ok(report.sections.some((section) => section.id === "unresolved_risks"));
});
