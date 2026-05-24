import assert from "node:assert/strict";
import test from "node:test";
import { createFinalApiPersistenceRuntime } from "../../src/application/foundation/FinalApiPersistenceFoundation";
import type { P0AuthContextDto } from "../../src/application/foundation/P0AuthBoundaryRuntimeConfig";
import { businessFoundationSeedFixture } from "../../../contracts/types/businessFoundation.fixture";

const boundary: P0AuthContextDto = {
  actorId: "activity_agent",
  tenantId: "tenant_activity",
  sessionId: "session_activity",
  surface: "test",
  requestId: "req_activity_management",
};

test("activity management slice creates activity, parses rules, plans execution path and runs simulation", async () => {
  const runtime = createFinalApiPersistenceRuntime({ adapter: "memory" });
  const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture, boundary);
  const activity = await runtime.activityService.create(
    {
      name: "618 活动管理验收",
      platform: "tmall",
      categoryScope: ["食品"],
      productScopeText: "当前采集 SKU",
    },
    boundary,
  );

  assert.equal(activity.status, "DRAFT");
  assert.ok(activity.latestRunId?.startsWith("workflow"));

  const planAfterParse = await runtime.activityService.parseForActivity(
    activity.activityId,
    {
      sourceText: "活动库存不得低于 80 件，资质状态需要人工确认。",
      rules: [
        { id: "stock_min", type: "threshold", field: "stock", operator: "gte", value: 80, message: "活动库存不得低于 80 件", severity: "blocking" },
        { id: "certificate_review", type: "manual_review", message: "资质状态需要人工确认", severity: "warning" },
      ],
    },
    boundary,
  );

  assert.equal(planAfterParse.ruleSet.parseStatus, "NEEDS_REVIEW");
  assert.equal(planAfterParse.steps.length, 6);
  assert.ok(planAfterParse.requiredFields.some((item) => item.field === "stock" && item.status === "READY"));
  assert.ok(planAfterParse.pendingConfirmations.some((item) => item.type === "RULE_AMBIGUITY"));

  const simulation = await runtime.activityService.simulateForActivity(
    activity.activityId,
    { skuProfileIds: ingest.summaries.slice(0, 2).map((item) => item.skuProfileId) },
    boundary,
  );

  assert.equal(simulation.activityId, activity.activityId);
  assert.equal(simulation.results.length, 2);
  assert.ok(simulation.evidenceRefs.length > 0);
  assert.ok(simulation.plan.some((step) => step.stepKey === "simulate_readiness" && step.status === "DONE"));

  const fetched = await runtime.activityService.simulationDetail(activity.activityId, simulation.simulationRunId, boundary);
  assert.equal(fetched?.simulationRunId, simulation.simulationRunId);
});
