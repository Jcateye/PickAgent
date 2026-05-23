import assert from "node:assert/strict";
import test from "node:test";
import { createFinalAgentEventStoreRuntime } from "../../src/application/foundation/FinalAgentEventStoreFoundation";

function seededRun() {
  const runtime = createFinalAgentEventStoreRuntime();
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

test("agent tool executor records policy output and denies unsafe or unregistered tools", () => {
  const { runtime, run } = seededRun();
  const allowed = runtime.agentService.executeTool({ runId: run.id, toolName: "sku_health_summary", inputJson: { skuProfileIds: ["sku_1"] } });

  assert.equal(allowed.permission, "ALLOW");
  assert.equal(allowed.riskLevel, "L1");
  assert.equal(allowed.reviewPolicy, "AUTO_ALLOW");
  assert.ok(allowed.evidenceRefs.length > 0);
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
