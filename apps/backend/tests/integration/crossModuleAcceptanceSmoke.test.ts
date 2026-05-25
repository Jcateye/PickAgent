import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { mapDouyinBusinessHttpRecords } from "../../src/application/foundation/DouyinBusinessHttpAdapter";
import { createBusinessFoundationRuntime } from "../../src/application/foundation/BusinessFoundationServices";

test("cross-module acceptance chain connects doudian ingest, health, activity, review, report and agent gate", () => {
  const records = JSON.parse(fs.readFileSync("source/business-http-records-2026-05-23-11-53-35.json", "utf8")) as Array<Record<string, unknown>>;
  const mapping = mapDouyinBusinessHttpRecords(records, {
    storeId: "fxg_acceptance_store",
    collectedAt: "2026-05-23T11:53:35.000Z",
  });
  assert.ok(mapping.ingestPayload.rows.length > 0, "doudian stock records must map to SKU ingest rows");
  assert.ok(mapping.sourceEndpoints.some((item) => item.endpoint === "POST /stock/manage/list"));

  const runtime = createBusinessFoundationRuntime();
  const ingestResult = runtime.ingestService.ingest(mapping.ingestPayload);
  assert.equal(ingestResult.summaries.length, mapping.ingestPayload.rows.length);
  assert.equal(runtime.skuQueryService.getHealthSummary().total, mapping.ingestPayload.rows.length);

  const firstSkuProfileId = ingestResult.summaries[0]?.skuProfileId;
  assert.ok(firstSkuProfileId, "ingest must create at least one SKU profile");
  const skuDetail = runtime.skuQueryService.getSkuDetail(firstSkuProfileId);
  assert.equal(skuDetail?.platform, "douyin_fxg");
  assert.ok(skuDetail.latestSnapshot?.raw.fxg, "SKU detail must retain fxg raw evidence");

  const ruleSet = runtime.activityRuleService.parseRules({
    name: "抖店商机活动准入验收规则",
    platform: "douyin_fxg",
    sourceText: "活动库存不得低于 80 件，business_chance_center 商机线索需要人工确认。",
    rules: [
      {
        id: "stock_min_acceptance",
        type: "threshold",
        field: "stock",
        operator: "gte",
        value: 80,
        message: "活动库存不得低于 80 件",
        severity: "blocking",
      },
      ...mapping.businessChanceRules,
    ],
  });
  assert.equal(ruleSet.parseStatus, "NEEDS_REVIEW");

  const simulation = runtime.activitySimulationService.runSimulation({
    ruleSetId: ruleSet.ruleSetId,
    skuProfileIds: ingestResult.summaries.slice(0, 3).map((item) => item.skuProfileId),
  });
  assert.ok(simulation.length > 0);
  assert.ok(simulation.every((item) => item.evidence.some((evidence) => evidence.type === "rule")));
  assert.ok(simulation.some((item) => item.eligibility === "MANUAL_REVIEW"));

  const reviews = runtime.reviewService.createReviewItems(
    simulation
      .filter((item) => item.eligibility === "MANUAL_REVIEW" || item.eligibility === "BLOCKED")
      .map((item) => ({
        skuProfileId: item.skuProfileId,
        sourceType: "simulation" as const,
        sourceId: item.simulationResultId,
        question: "商机活动准入是否允许继续推进？",
        recommendation: "先由运营确认 business_chance_center 线索，再回归模拟。",
        riskLevel: "L2" as const,
        evidence: item.evidence,
      })),
  );
  assert.ok(reviews.length > 0);
  assert.ok(reviews.every((item) => item.status === "OPEN"));

  const decidedReview = runtime.reviewService.decide(reviews[0].reviewItemId, "REQUEST_CHANGES", "acceptance@pickagent.local", "需要补齐活动线索归属后重跑。");
  assert.equal(decidedReview.status, "CHANGES_REQUESTED");

  const report = runtime.reportService.generatePreview({
    type: "ACTIVITY",
    skuProfileIds: ingestResult.summaries.slice(0, 3).map((item) => item.skuProfileId),
    simulationResultIds: simulation.map((item) => item.simulationResultId),
  });
  assert.equal(report.status, "PREVIEW");
  assert.ok(report.sections.some((section) => section.id === "unresolved_risks" && section.summary.includes("MANUAL_REVIEW")));

  assert.deepEqual(
    runtime.agentToolRegistry.listTools().map((tool) => tool.name),
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
  const toolResult = runtime.agentToolRegistry.execute("getSkuSummary", { skuProfileId: firstSkuProfileId });
  assert.equal(toolResult.status, "SUCCEEDED");
  assert.ok(toolResult.trace.some((item) => item.step === "service_boundary"));

  const agentRun = runtime.fakeAgentLoopAdapter.startMission({
    objective: "验收抖店 SKU 活动准入风险并停在 Review Gate",
    skuProfileId: firstSkuProfileId,
  });
  assert.equal(agentRun.run.status, "PAUSED");
  assert.equal(agentRun.reviewGates[0]?.status, "PENDING");
  assert.deepEqual([...runtime.fakeAgentLoopAdapter.disabledRuntimeTools], ["coding", "file", "bash"]);

  const continuedRun = runtime.fakeAgentLoopAdapter.continueMission(agentRun, {
    decision: "approve",
    comment: "验收 smoke 批准继续，fake adapter 不执行真实高风险动作。",
  });
  assert.equal(continuedRun.run.status, "DONE");
  assert.equal(continuedRun.reviewGates[0]?.status, "APPROVED");
});
