import assert from "node:assert/strict";
import test from "node:test";
import { AgentToolPolicy, createFinalAgentEventStoreRuntime } from "../../src/application/foundation/FinalAgentEventStoreFoundation";
import { createP0RuntimeConfig } from "../../src/application/foundation/P0AuthBoundaryRuntimeConfig";

function seededRun() {
  const runtime = createFinalAgentEventStoreRuntime();
  runtime.businessRuntime.ingestService.ingest({
    connectorId: "pi_test_seed",
    collectedAt: "2026-05-23T10:00:00.000Z",
    rows: [
      {
        platform: "tmall",
        storeId: "store_demo",
        externalSkuId: "sku_001",
        productName: "Pi 测试 SKU",
        sales30d: 120,
        positiveRate: 0.98,
        stock: 88,
        originalPrice: 79,
        lowestPrice30d: 69,
        campaignPrice: 59,
        certificateStatus: "valid",
        raw: { title: "Pi 测试 SKU" },
      },
    ],
  });
  const { mission } = runtime.agentService.createMission({ sessionKey: "session-final-agent", objective: "检查活动准入风险" });
  const run = runtime.agentService.startRun(mission.id, { modelProvider: "test", modelName: "foundation-test", inputJson: { objective: mission.objective } });
  return { runtime, mission, run };
}

test("agent event store appends before replay and lists missing events after sequence", () => {
  const { runtime, run } = seededRun();
  const first = runtime.eventStore.append({ runId: run.id, eventType: "assistant.delta", eventPhase: "stream", payloadJson: { text: "准备检查" } });
  const second = runtime.eventStore.append({ runId: run.id, eventType: "assistant.delta", eventPhase: "stream", payloadJson: { text: "读取证据" } });

  assert.equal(first.sequence, 2);
  assert.equal(second.sequence, 3);
  assert.deepEqual(
    runtime.agentService.listEvents(run.id, first.sequence).map((event) => event.id),
    [second.id],
  );
});

test("agent repository creates session mission run tool call review gate and continuation run", () => {
  const { runtime, mission, run } = seededRun();
  const gate = runtime.agentService.createReviewGateForTest({
    missionId: mission.id,
    runId: run.id,
    reasonCode: "manual_confirmation_required",
    question: "是否继续执行高风险动作？",
    evidenceRefs: [{ type: "agent_event", entityId: run.id, label: "Agent Run", summary: "人工确认前暂停" }],
  });

  const decision = runtime.agentService.decideReviewGate(gate.id, { decision: "APPROVE", decidedBy: "ops@example.test", decisionComment: "允许继续检查" });

  assert.equal(runtime.state.sessions.size, 1);
  assert.equal(runtime.state.missions.get(mission.id)?.id, mission.id);
  assert.equal(runtime.state.runs.size, 2);
  assert.equal(runtime.state.reviewGates.get(gate.id)?.status, "APPROVED");
  assert.equal(decision.continuationRun.missionId, mission.id);
  assert.equal(decision.event.eventType, "run.continuation_started");
});

test("agent review gate request changes maps to frontend modified status", () => {
  const { runtime, mission, run } = seededRun();
  const gate = runtime.agentService.createReviewGateForTest({
    missionId: mission.id,
    runId: run.id,
    reasonCode: "needs_changes",
    question: "是否需要修改 Agent 建议？",
    evidenceRefs: [],
  });

  const decision = runtime.agentService.decideReviewGate(gate.id, {
    decision: "REQUEST_CHANGES",
    decidedBy: "ops@example.test",
    decisionComment: "需要修改建议后再继续。",
  });

  assert.equal(decision.gate.status, "MODIFIED");
  assert.equal(runtime.state.reviewGates.get(gate.id)?.status, "MODIFIED");
  assert.ok(runtime.agentService.listEvents(run.id).some((event) => event.eventType === "review_gate.decided" && event.eventPhase === "MODIFIED"));
});

test("pi adapter only exposes three low-risk tools and executes through real business services", () => {
  const { runtime, run } = seededRun();
  assert.deepEqual([...runtime.piAdapter.availableTools], [
    "getSkuSummary",
    "checkDataFreshness",
    "diagnoseSkuHealth",
    "parseActivityRules",
    "simulateActivityReadiness",
    "explainDecisionWithEvidence",
  ]);

  const ruleSet = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "parseActivityRules",
    inputJson: { name: "Pi 测试规则", sourceText: "活动库存不少于 20，好评率不少于 92%，证书状态必须有效。" },
  });
  const ruleSetId = (ruleSet.toolCall.outputJson.result as { ruleSetId: string }).ruleSetId;
  const allowed = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "runSimulation",
    inputJson: { ruleSetId, skuProfileIds: [Array.from(runtime.businessRuntime.store.projections.keys())[0]] },
  });

  assert.equal(allowed.permission, "ALLOW");
  assert.equal(allowed.toolCall.toolName, "simulateActivityReadiness");
  assert.equal(allowed.riskLevel, "L1");
  assert.equal(allowed.reviewPolicy, "AUTO_ALLOW");
  assert.ok(allowed.evidenceRefs.length > 1);
  assert.equal(runtime.state.toolCalls.get(allowed.toolCall.id)?.status, "SUCCEEDED");

  for (const toolName of ["unknown_tool", "coding", "file.read", "bash", "direct SQL", "credential access", "cookie_reader", "token_vault"]) {
    const result = runtime.agentService.executeTool({ runId: run.id, toolName, inputJson: { request: "blocked" } });
    assert.equal(result.permission, "DENY", toolName);
    assert.equal(result.riskLevel, "L3", toolName);
    assert.equal(result.reviewPolicy, "DENY", toolName);
    assert.equal(result.toolCall.status, "BLOCKED", toolName);
    assert.match(result.toolCall.blockedReason ?? "", /outside AgentToolExecutor policy|not registered|toolName is required/);
  }
});

test("production ToolPolicy allowlist and denylist fail closed", () => {
  const config = createP0RuntimeConfig({ NODE_ENV: "production" });
  const policy = new AgentToolPolicy(config);

  for (const toolName of config.productionToolAllowlist) {
    const decision = policy.decide(toolName);
    assert.equal(decision.permission, "ALLOW", toolName);
    assert.equal(decision.reviewPolicy, "AUTO_ALLOW", toolName);
  }

  for (const toolName of ["coding", "file.read", "bash.exec", "sql.query", "credential_access", "cookie_reader", "token_vault", "JWT.sign", "SSO.login", "secret.get", "api key list"]) {
    const decision = policy.decide(toolName);
    assert.equal(decision.permission, "DENY", toolName);
    assert.equal(decision.reviewPolicy, "DENY", toolName);
  }

  assert.equal(policy.decide("diagnoseSkuHealth").permission, "ALLOW");
  assert.equal(policy.decide("runSimulation").permission, "ALLOW");
});

test("production Pi adapter smoke exposes only allowlisted tools and hides dangerous runtime tools", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.P0_ALLOW_DEV_AUTH_FALLBACK;
  process.env.NODE_ENV = "production";
  try {
    const { runtime } = seededRun();
    const tools = [...runtime.piAdapter.availableTools];
    assert.deepEqual(tools, [
      "getSkuSummary",
      "checkDataFreshness",
      "diagnoseSkuHealth",
      "parseActivityRules",
      "simulateActivityReadiness",
      "explainDecisionWithEvidence",
    ]);
    for (const denied of ["coding", "file", "bash", "sql", "credential", "cookie", "token", "jwt", "sso", "secret", "api key"]) {
      assert.ok(!tools.some((tool) => tool.toLowerCase().includes(denied)));
      assert.ok(runtime.piAdapter.disabledRuntimeTools.includes(denied));
    }
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("tool call persistence and events redact credential-like fields", () => {
  const { runtime, run } = seededRun();
  const result = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "token_vault",
    inputJson: {
      token: "real-token-value",
      nested: { apiKey: "real-api-key", safe: "visible" },
    },
  });
  const event = runtime.agentService.listEvents(run.id).find((item) => item.eventType === "tool.call_recorded" && item.payloadJson.toolCallId === result.toolCall.id);

  assert.equal(result.toolCall.inputJson.token, "[REDACTED]");
  assert.deepEqual(result.toolCall.inputJson.nested, { apiKey: "[REDACTED]", safe: "visible" });
  assert.ok(event);
  assert.doesNotMatch(JSON.stringify(event!.payloadJson), /real-token-value|real-api-key/);
});

test("createReviewItems opens review gate before write and decision creates continuation replay chain", () => {
  const { runtime, run } = seededRun();
  const result = runtime.agentService.executeTool({
    runId: run.id,
    toolName: "createReviewItems",
    inputJson: {
      items: [
        {
          skuProfileId: Array.from(runtime.businessRuntime.store.projections.keys())[0],
          sourceType: "agent",
          sourceId: run.id,
          question: "是否允许创建 Review item？",
          recommendation: "先进入 Review Gate。",
          riskLevel: "L2",
          evidence: [],
        },
      ],
    },
  });

  assert.equal(result.permission, "REVIEW_REQUIRED");
  assert.equal(result.reviewPolicy, "REVIEW_GATE");
  assert.equal(result.toolCall.status, "REVIEW_REQUIRED");
  assert.ok(result.reviewGate);

  const beforeDecision = runtime.agentService.listEvents(run.id);
  assert.ok(beforeDecision.some((event) => event.eventType === "review_gate.opened"));
  assert.ok(beforeDecision.some((event) => event.eventType === "tool.call_recorded" && event.eventPhase === "REVIEW_REQUIRED"));

  const decision = runtime.agentService.decideReviewGate(result.reviewGate!.id, {
    decision: "APPROVE",
    decidedBy: "pi-smoke@test.local",
    decisionComment: "允许继续进入 Review 工作台。",
  });
  const originalReplay = runtime.agentService.listEvents(run.id);
  const continuationReplay = runtime.agentService.listEvents(decision.continuationRun.id);

  assert.ok(originalReplay.some((event) => event.eventType === "review_gate.decided"));
  assert.ok(continuationReplay.some((event) => event.eventType === "run.continuation_started"));
  assert.equal(decision.continuationRun.inputJson.continuationOfRunId, run.id);
});

test("agent event store can mark status and link workflow step through append-only events", () => {
  const { runtime, run } = seededRun();
  const linked = runtime.eventStore.linkWorkflowStep(run.id, "workflow_step_001");
  const completed = runtime.eventStore.markRunStatus(run.id, "SUCCEEDED", { summary: "done" });
  const events = runtime.agentService.listEvents(run.id);

  assert.equal(linked.metadataJson.workflowStepId, "workflow_step_001");
  assert.equal(completed.status, "SUCCEEDED");
  assert.equal(completed.outputJson.summary, "done");
  assert.ok(events.some((event) => event.eventType === "run.workflow_step_linked"));
  assert.ok(events.some((event) => event.eventType === "run.status_changed"));
});
