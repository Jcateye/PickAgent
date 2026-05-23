import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { mapDouyinBusinessHttpRecords } from "../../src/application/foundation/DouyinBusinessHttpAdapter";
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

test("douyin fxg captured stock records map into ingest payload and business chance rules", () => {
  const records = JSON.parse(fs.readFileSync("source/business-http-records-2026-05-23-11-53-35.json", "utf8")) as Array<Record<string, unknown>>;
  const mapping = mapDouyinBusinessHttpRecords(records, {
    storeId: "fxg_capture_demo",
    collectedAt: "2026-05-23T11:53:35.000Z",
  });

  assert.ok(mapping.ingestPayload.rows.length >= 1);
  assert.equal(mapping.ingestPayload.rows[0]?.platform, "douyin_fxg");
  assert.equal(mapping.ingestPayload.rows[0]?.externalSkuId, "3668752191222018");
  assert.equal(mapping.ingestPayload.rows[0]?.stock, 20000);
  assert.equal(mapping.ingestPayload.rows[0]?.certificateStatus, "valid");
  assert.ok(mapping.businessChanceRules.length >= 1);
  assert.equal(mapping.businessChanceRules[0]?.type, "manual_review");

  const runtime = createBusinessFoundationRuntime();
  const ingestResult = runtime.ingestService.ingest(mapping.ingestPayload);
  assert.equal(ingestResult.summaries.length, mapping.ingestPayload.rows.length);

  const ruleSet = runtime.activityRuleService.parseRules({
    name: "抖店商机线索人工复核",
    platform: "douyin_fxg",
    sourceText: "business_chance_center 商机线索需要人工确认是否转成活动规则。",
    rules: mapping.businessChanceRules,
  });
  assert.equal(ruleSet.parseStatus, "NEEDS_REVIEW");
});

test("activity rule parser preserves numeric thresholds and business chance manual review context", () => {
  const runtime = createBusinessFoundationRuntime();
  const ruleSet = runtime.activityRuleService.parseRules({
    name: "抖店商机活动准入规则",
    platform: "douyin_fxg",
    sourceText: "活动库存不得低于 80 件，business_chance_center 商机线索需要人工确认。",
  });

  assert.equal(ruleSet.parseStatus, "NEEDS_REVIEW");
  assert.equal(ruleSet.rules.find((rule) => rule.id === "stock_min")?.value, 80);
  assert.equal(ruleSet.rules.find((rule) => rule.id === "business_chance_manual_review")?.type, "manual_review");
});
