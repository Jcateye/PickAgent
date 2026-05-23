import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentRepository,
  InMemoryAgentEventStore,
  createFinalAgentEventStoreRuntime,
} from "../../src/application/foundation/FinalAgentEventStoreFoundation";

function seedRuntime() {
  const runtime = createFinalAgentEventStoreRuntime();
  runtime.businessRuntime.ingestService.ingest({
    connectorId: "p0_agent_seed",
    collectedAt: "2026-05-24T01:00:00.000Z",
    rows: [
      {
        platform: "tmall",
        storeId: "store_p0",
        externalSkuId: "sku_p0",
        productName: "P0 Agent SKU",
        sales30d: 80,
        positiveRate: 0.96,
        stock: 60,
        originalPrice: 100,
        lowestPrice30d: 90,
        campaignPrice: 80,
        certificateStatus: "valid",
        raw: { title: "P0 Agent SKU" },
      },
    ],
  });
  const { mission } = runtime.agentService.createMission({
    sessionKey: "p0-agent-session",
    objective: "恢复 Agent EventStore 审计链",
    workbenchContextJson: {
      route: "/activities",
      selectedEntity: { entityType: "activityRuleSet", entityId: "rule_set_p0" },
    },
  });
  const run = runtime.agentService.startRun(mission.id, {
    modelProvider: "pi",
    modelName: "p0-persistence-test",
    inputJson: {
      objective: mission.objective,
      nested: { token: "should-not-persist", apiKey: "should-not-persist" },
    },
  });
  return { runtime, mission, run };
}

test("P0 persistent repository contract restores append/listAfter/status after adapter restart", () => {
  const { runtime, run } = seedRuntime();
  const first = runtime.eventStore.append({
    runId: run.id,
    eventType: "assistant.delta",
    eventPhase: "stream",
    payloadJson: { text: "准备恢复", jwt: "should-not-persist" },
  });
  const second = runtime.eventStore.markRunStatus(run.id, "SUCCEEDED", { summary: "done", secret: "should-not-persist" });

  const restartedRepository = new AgentRepository(runtime.state);
  const restartedEventStore = new InMemoryAgentEventStore(restartedRepository, runtime.state);
  const replay = restartedEventStore.listAfter(run.id, first.sequence);

  assert.equal(first.sequence, 2);
  assert.equal(second.status, "SUCCEEDED");
  assert.deepEqual(replay.map((event) => event.sequence), [3]);
  assert.equal(replay[0]?.eventType, "run.status_changed");
  assert.equal((replay[0]?.payloadJson as { errorMessage: null }).errorMessage, null);
});

test("P0 audit chain links AgentRun to WorkflowRun and important tool call to WorkflowStep", () => {
  const { runtime, run } = seedRuntime();
  const result = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "parseActivityRules",
    inputJson: { name: "P0 规则", sourceText: "库存不少于 20，证书有效。" },
  });

  assert.ok(run.workflowRunId);
  assert.ok(runtime.state.workflowRuns.get(run.workflowRunId));
  assert.ok(result.toolCall.workflowStepId);
  const workflowStep = runtime.state.workflowSteps.get(result.toolCall.workflowStepId);
  assert.equal(workflowStep?.runId, run.workflowRunId);
  assert.equal(workflowStep?.stepKey, "tool.parseActivityRules");
  assert.equal(workflowStep?.status, "SUCCEEDED");
});

test("P0 review gate creates formal ReviewItem and continuation replay chain", () => {
  const { runtime, run } = seedRuntime();
  const result = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "createReviewItems",
    inputJson: {
      cookie: "should-not-persist",
      items: [
        {
          sourceType: "agent",
          sourceId: run.id,
          question: "是否创建正式 ReviewItem？",
          recommendation: "先通过 Review Gate。",
          riskLevel: "L2",
          evidence: [],
        },
      ],
    },
  });

  assert.equal(result.permission, "REVIEW_REQUIRED");
  assert.ok(result.reviewGate?.reviewItemId);
  const reviewItem = runtime.state.reviewItems.get(result.reviewGate.reviewItemId);
  assert.equal(reviewItem?.reviewType, "agent_review_gate");
  assert.equal(reviewItem?.status, "PENDING");
  assert.equal(reviewItem?.evidenceJson.gateId, result.reviewGate.id);

  const decision = runtime.agentService.decideReviewGate(result.reviewGate.id, {
    decision: "APPROVE",
    decidedBy: "reviewer@example.test",
  });
  assert.ok(runtime.agentService.listEvents(run.id).some((event) => event.eventType === "review_gate.decided"));
  assert.ok(runtime.agentService.listEvents(decision.continuationRun.id).some((event) => event.eventType === "run.continuation_started"));
});

test("P0 EventStore/SSE replay contract restores Copilot state without fake defaults", () => {
  const { runtime, run } = seedRuntime();
  runtime.eventStore.append({
    runId: run.id,
    eventType: "assistant.delta",
    eventPhase: "plan",
    payloadJson: { plan: [{ id: "step-1", status: "running" }] },
  });
  const tool = runtime.agentService.executeTool({ runId: run.id, toolName: "parseActivityRules", inputJson: { sourceText: "证书有效。" } });
  const replay = runtime.agentService.listEvents(run.id, 0);
  const ssePayload = replay.map((event) => `id: ${event.sequence}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`).join("");

  assert.ok(replay.some((event) => event.eventType === "run.started"));
  assert.ok(replay.some((event) => event.eventType === "tool.call_recorded"));
  assert.match(ssePayload, /event: tool\.call_recorded/);
  assert.equal((replay.at(-1)?.payloadJson as { toolCallId?: string }).toolCallId, tool.toolCall.id);
});

test("P0 repository adapter sanitizes sensitive input and keeps Pi adapter away from DB/service primitives", () => {
  const { runtime, run } = seedRuntime();
  const denied = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "token_vault",
    inputJson: { token: "should-not-persist", nested: { authorization: "Bearer secret" } },
  });
  const serialized = JSON.stringify({
    run: runtime.state.runs.get(run.id),
    events: runtime.agentService.listEvents(run.id),
    toolCall: denied.toolCall,
  });

  assert.equal(denied.permission, "DENY");
  assert.doesNotMatch(serialized, /should-not-persist|Bearer secret/);
  assert.match(serialized, /\[REDACTED\]/);
  assert.deepEqual([...runtime.piAdapter.availableTools], [
    "getSkuSummary",
    "checkDataFreshness",
    "diagnoseSkuHealth",
    "parseActivityRules",
    "simulateActivityReadiness",
    "explainDecisionWithEvidence",
  ]);
  assert.equal("state" in runtime.piAdapter, false);
  assert.equal("businessRuntime" in runtime.piAdapter, false);
});
