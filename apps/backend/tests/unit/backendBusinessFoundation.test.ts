import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { mapDouyinBusinessHttpRecords } from "../../src/application/foundation/DouyinBusinessHttpAdapter";
import { createBusinessFoundationRuntime } from "../../src/application/foundation/BusinessFoundationServices";

test("backend business foundation supports ingest, projection, simulation, review, report and agent tools", () => {
  const runtime = createBusinessFoundationRuntime();

  const ingestResult = runtime.ingestService.ingest(businessFoundationSeedFixture);
  assert.equal(ingestResult.summaries.length, businessFoundationSeedFixture.rows.length);

  const summary = runtime.skuQueryService.getHealthSummary();
  assert.equal(summary.total, businessFoundationSeedFixture.rows.length);

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
  assert.equal(simulation.length, businessFoundationSeedFixture.rows.length);
  assert.equal(simulation[0]?.eligibility, "DIRECT_READY");
  assert.deepEqual(
    runtime.activitySimulationService.simulateActivityReadiness({
      ruleSetId: ruleSet.ruleSetId,
      skuProfileIds: [ingestResult.summaries[0]?.skuProfileId ?? "missing"],
    })[0]?.eligibility,
    simulation[0]?.eligibility,
  );

  const freshness = runtime.skuQueryService.checkDataFreshness({
    skuProfileId: ingestResult.summaries[0]?.skuProfileId ?? "missing",
    now: "2026-05-23T18:00:00.000Z",
    maxAgeHours: 24,
  });
  assert.equal(freshness.isFresh, true);
  assert.equal(freshness.snapshotId !== null, true);

  const diagnosis = runtime.skuQueryService.getLatestDiagnosis(ingestResult.summaries[0]?.skuProfileId ?? "missing");
  assert.equal(diagnosis?.healthStatus, "READY");

  const explanation = runtime.skuQueryService.explainDecisionWithEvidence({
    skuProfileId: ingestResult.summaries[0]?.skuProfileId ?? "missing",
    simulationResultId: simulation[0]?.simulationResultId,
    question: "是否可以继续报名？",
  });
  assert.match(explanation.summary, /活动准入结果/);
  assert.ok(explanation.evidence.length > 0);

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
  assert.ok(report.evidenceSummary.length > 0);
  assert.ok(report.sections.some((section) => section.id === "unresolved_risks"));

  const tools = runtime.agentToolRegistry.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "getSkuSummary",
      "parseActivityRules",
      "simulateActivityReadiness",
      "runSimulation",
      "checkDataFreshness",
      "diagnoseSkuHealth",
      "createReviewItems",
      "explainDecisionWithEvidence",
      "generateReport",
      "generateReportPreview",
    ],
  );
  const toolResult = runtime.agentToolRegistry.execute("getSkuSummary", { skuProfileId: ingestResult.summaries[0]?.skuProfileId });
  assert.equal(toolResult.status, "SUCCEEDED");
  assert.equal(runtime.agentToolRegistry.execute("runSimulation", { ruleSetId: ruleSet.ruleSetId, skuProfileIds: [ingestResult.summaries[0]?.skuProfileId] }).status, "SUCCEEDED");
  assert.equal(runtime.agentToolRegistry.execute("simulateActivityReadiness", { ruleSetId: ruleSet.ruleSetId, skuProfileIds: [ingestResult.summaries[0]?.skuProfileId] }).status, "SUCCEEDED");
  assert.equal(runtime.agentToolRegistry.execute("checkDataFreshness", { skuProfileId: ingestResult.summaries[0]?.skuProfileId }).status, "SUCCEEDED");
  assert.equal(runtime.agentToolRegistry.execute("diagnoseSkuHealth", { skuProfileId: ingestResult.summaries[0]?.skuProfileId }).status, "SUCCEEDED");
  assert.equal(
    runtime.agentToolRegistry.execute("explainDecisionWithEvidence", {
      skuProfileId: ingestResult.summaries[0]?.skuProfileId,
      simulationResultId: simulation[0]?.simulationResultId,
    }).status,
    "SUCCEEDED",
  );
  assert.equal(runtime.agentToolRegistry.execute("generateReport", { type: "ACTIVITY", skuProfileIds: [ingestResult.summaries[0]?.skuProfileId], simulationResultIds: [simulation[0]?.simulationResultId] }).status, "SUCCEEDED");

  const agentRun = runtime.fakeAgentLoopAdapter.startMission({
    objective: "复核第一个 SKU 的活动准入风险",
    skuProfileId: ingestResult.summaries[0]?.skuProfileId,
  });
  assert.equal(agentRun.run.provider, "fake");
  assert.equal(agentRun.eventContractVersion, "agent-run-events.v1");
  assert.equal(agentRun.run.status, "PAUSED");
  assert.equal(agentRun.reviewGates[0]?.status, "PENDING");
  assert.ok(agentRun.toolTrace.some((item) => item.toolName === "getSkuSummary" && item.status === "succeeded"));
  assert.deepEqual([...runtime.fakeAgentLoopAdapter.disabledRuntimeTools], ["coding", "file", "bash"]);

  const continuedRun = runtime.fakeAgentLoopAdapter.continueMission(agentRun, { decision: "approve" });
  assert.equal(continuedRun.run.status, "DONE");
  assert.equal(continuedRun.reviewGates[0]?.status, "APPROVED");
});

test("activity rule parser recognizes hackathon campaign rules from challenge screenshot", () => {
  const runtime = createBusinessFoundationRuntime();
  const ruleSet = runtime.activityRuleService.parseRules({
    name: "天猫 618 大促选品规则",
    platform: "tmall",
    sourceText: [
      "参与商品必须满足：近 30 天销量≥100 件；好评率≥95%；库存≥500 件。",
      "价格要求：活动价不得高于近 30 天最低价；折扣力度≥7 折。",
      "品类限制：黄金类目单店最多 5 个 SKU；钻石类目单店最多 10 个 SKU。",
      "互斥规则：已参加“品牌日”活动的商品不可重复报名。",
    ].join("\n"),
  });

  assert.equal(ruleSet.parseStatus, "PARSED");
  assert.deepEqual(
    ruleSet.rules.map((rule) => rule.id),
    [
      "sales_30d_min",
      "stock_min",
      "positive_rate",
      "campaign_price_lte_lowest_30d",
      "campaign_discount_min",
      "gold_category_quota",
      "diamond_category_quota",
      "brand_day_mutex",
    ],
  );
  assert.deepEqual(
    ruleSet.rules.map((rule) => rule.type),
    ["threshold", "threshold", "threshold", "field_compare", "field_compare", "quota", "quota", "threshold"],
  );
  assert.equal(ruleSet.rules.find((rule) => rule.id === "sales_30d_min")?.value, 100);
  assert.equal(ruleSet.rules.find((rule) => rule.id === "positive_rate")?.value, 0.95);
  assert.equal(ruleSet.rules.find((rule) => rule.id === "stock_min")?.value, 500);
  assert.equal(ruleSet.rules.find((rule) => rule.id === "campaign_discount_min")?.value, 0.7);
  assert.equal(ruleSet.rules.find((rule) => rule.id === "brand_day_mutex")?.value, true);
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

test("ingest normalizes browser DOM metrics when top-level metrics are missing", () => {
  const runtime = createBusinessFoundationRuntime();
  const result = runtime.ingestService.ingest({
    connectorId: "doudian-browser-extension",
    collectedAt: "2026-05-24T09:30:00.000Z",
    rows: [
      {
        platform: "doudian",
        storeId: "fxg.jinritemai.com",
        externalSkuId: "3818388858177978472",
        productName: "韩版夏季短袖上衣",
        stock: 98,
        raw: {
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

  assert.equal(result.snapshots[0]?.sales30d, 4);
  assert.equal(result.snapshots[0]?.positiveRate, 1);
  assert.equal(result.snapshots[0]?.normalized.qualityScore, 85);
  assert.equal(result.diagnoses[0]?.dataQualityScore, 100);
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
