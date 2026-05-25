import assert from "node:assert/strict";
import test from "node:test";
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";
import { createFinalApiPersistenceRuntime } from "../../src/application/foundation/FinalApiPersistenceFoundation";

const boundary = {
  actorId: "review_report_agent",
  tenantId: "tenant_review_report",
  sessionId: "session_review_report",
  surface: "unit-test",
  requestId: "req_review_report",
};

test("review workbench detail, decision audit, report versions, export and subscription are service-backed", async () => {
  const runtime = createFinalApiPersistenceRuntime({ adapter: "memory" });
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture, boundary);
  const ruleSet = await runtime.activityService.parse({ name: "618 活动准入规则", platform: "tmall", sourceText: businessFoundationActivityRuleText }, boundary);
  const simulation = await runtime.activityService.simulate(ruleSet.ruleSetId, { skuProfileIds: ingest.summaries.map((item) => item.skuProfileId) }, boundary);
  const reviewTarget = simulation.results.find((item) => item.eligibility !== "DIRECT_READY") ?? simulation.results[0];
  assert.ok(reviewTarget);

  const [createdReview] = await runtime.reviewService.create(
    [
      {
        skuProfileId: reviewTarget.skuProfileId,
        sourceType: "simulation",
        sourceId: reviewTarget.simulationResultId,
        question: "是否允许该 SKU 在修复后进入活动准备？",
        recommendation: "先按 evidence 修复后，再由 Review 工作台保留人工决策。",
        riskLevel: "L2",
        evidence: reviewTarget.evidence,
      },
    ],
    boundary,
  );
  assert.ok(createdReview);

  const reviewList = await runtime.reviewService.list({ tab: "PENDING", riskLevel: "HIGH" }, boundary);
  assert.equal(reviewList.total, 1);
  const reviewDetail = await runtime.reviewService.getDetail(createdReview.reviewItemId, boundary);
  assert.equal(reviewDetail?.recommendation.actionType, "CONFIRM_RULE");
  assert.ok(reviewDetail.evidenceRefs.length > 0);
  assert.ok(reviewDetail.relatedRun);

  const decided = await runtime.reviewService.decide(createdReview.reviewItemId, { decision: "REQUEST_CHANGES", decisionBy: "qa@pickagent.local", decisionComment: "补充规则证据后重跑。" }, boundary);
  assert.equal(decided.status, "MODIFIED");
  assert.ok(decided.approvalHistory.some((item) => item.action === "review_decision"));

  const preview = await runtime.reportService.generate(
    {
      type: "ACTIVITY",
      skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
      simulationResultIds: simulation.results.map((item) => item.simulationResultId),
    },
    boundary,
  );
  const reportDetail = await runtime.reportService.getDetail(preview.reportId, boundary);
  assert.equal(reportDetail?.tabs.includes("EVIDENCE"), true);
  assert.ok(reportDetail.summary.totalSku > 0);
  assert.ok(reportDetail.evidenceSummary.length > 0);

  const versions = await runtime.reportService.listVersions(preview.reportId, boundary);
  assert.equal(versions.total, 1);
  const version = await runtime.reportService.getVersion(preview.reportId, versions.items[0].versionId, boundary);
  assert.equal(version?.reportId, preview.reportId);

  const secondPreview = await runtime.reportService.generate(
    {
      type: "HEALTH",
      skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
      simulationResultIds: [],
    },
    boundary,
  );
  const comparison = await runtime.reportService.compare(preview.reportId, secondPreview.reportId, boundary);
  assert.equal(comparison.baseReportId, preview.reportId);
  assert.equal(comparison.targetReportId, secondPreview.reportId);

  const firstExport = await runtime.reportService.export(preview.reportId, { format: "PDF", idempotencyKey: "same-export" }, boundary);
  const secondExport = await runtime.reportService.export(preview.reportId, { format: "PDF", idempotencyKey: "same-export" }, boundary);
  assert.equal(secondExport.exportJobId, firstExport.exportJobId);

  const subscription = await runtime.reportService.saveSubscription(preview.reportId, { frequency: "WEEKLY", recipients: ["ops@pickagent.local"] }, boundary);
  assert.equal(subscription.reportId, preview.reportId);

  const audits = await runtime.workflowAuditService.list(boundary, 50);
  assert.equal(audits.filter((audit) => audit.workflowType === "report_export" && audit.subjectId === preview.reportId).length, 1);
  assert.ok(audits.some((audit) => audit.workflowType === "report_compare" && audit.subjectId === preview.reportId));
  assert.ok(audits.some((audit) => audit.workflowType === "report_subscription" && audit.subjectId === preview.reportId));
});

test("report generation rejects missing evidence inputs before writes", async () => {
  const runtime = createFinalApiPersistenceRuntime({ adapter: "memory" });
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture, boundary);
  const reportCountBeforeMissingSku = runtime.store.reports.size;

  await assert.rejects(
    () => runtime.reportService.generate({ type: "HEALTH", skuProfileIds: ["missing_sku_profile"], simulationResultIds: [] }, boundary),
    /SKU not found for report: missing_sku_profile/,
  );
  assert.equal(runtime.store.reports.size, reportCountBeforeMissingSku);

  const reportCountBeforeMissingSimulation = runtime.store.reports.size;
  await assert.rejects(
    () => runtime.reportService.generate({ type: "ACTIVITY", skuProfileIds: [ingest.summaries[0].skuProfileId], simulationResultIds: ["missing_simulation_result"] }, boundary),
    /Simulation result not found for report: missing_simulation_result/,
  );
  assert.equal(runtime.store.reports.size, reportCountBeforeMissingSimulation);
});
