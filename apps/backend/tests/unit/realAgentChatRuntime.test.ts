import assert from "node:assert/strict";
import test from "node:test";

import type { AgentMessage } from "../../src/domain/entities/AgentMessage";
import type { AgentMission } from "../../src/domain/entities/AgentMission";
import type { AgentRun } from "../../src/domain/entities/AgentRun";
import type { AgentRunEvent } from "../../src/domain/entities/AgentRunEvent";
import type { AgentSession } from "../../src/domain/entities/AgentSession";
import { RealAgentChatConfigurationError, RealAgentChatRuntime, type AgentConversationRepository } from "../../src/application/foundation/RealAgentChatRuntime";

class TestConversationRepository implements AgentConversationRepository {
  readonly sessions = new Map<string, AgentSession>();
  readonly missions: AgentMission[] = [];
  readonly runs: AgentRun[] = [];
  readonly messages: AgentMessage[] = [];
  readonly events: AgentRunEvent[] = [];

  private sequence = 0;

  async getOrCreateSession(input: { sessionKey: string; surface: string; title?: string | null }): Promise<AgentSession> {
    const existing = this.sessions.get(input.sessionKey);
    if (existing) return existing;
    const now = new Date().toISOString();
    const session: AgentSession = {
      id: this.nextId("session"),
      sessionKey: input.sessionKey,
      userId: null,
      surface: input.surface,
      piSessionKey: null,
      piSessionRef: null,
      title: input.title ?? null,
      status: "ACTIVE",
      configJson: {},
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(input.sessionKey, session);
    return session;
  }

  async createMission(input: {
    sessionId: string;
    objective: string;
    sourceSurface: string;
    subjectType?: string | null;
    subjectId?: string | null;
    workbenchContextJson?: Record<string, unknown>;
  }): Promise<AgentMission> {
    const now = new Date().toISOString();
    const mission: AgentMission = {
      id: this.nextId("mission"),
      sessionId: input.sessionId,
      missionType: "goal_driven",
      objective: input.objective,
      autonomyLevel: "review_required",
      status: "ACTIVE",
      sourceSurface: input.sourceSurface,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      constraintsJson: {},
      workbenchContextJson: input.workbenchContextJson ?? {},
      planJson: { steps: [] },
      nextActionsJson: { items: [] },
      createdBy: null,
      completedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.missions.push(mission);
    return mission;
  }

  async createRun(input: { sessionId: string; missionId: string; modelProvider: string; modelName: string; inputJson: Record<string, unknown> }): Promise<AgentRun> {
    const now = new Date().toISOString();
    const run: AgentRun = {
      id: this.nextId("run"),
      missionId: input.missionId,
      sessionId: input.sessionId,
      piRunId: null,
      workflowRunId: null,
      status: "RUNNING",
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      inputJson: input.inputJson,
      outputJson: {},
      errorMessage: null,
      timeoutMs: null,
      cancelRequested: false,
      usageJson: {},
      metadataJson: {},
      startedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.push(run);
    return run;
  }

  async appendMessage(input: {
    sessionId: string;
    runId: string | null;
    role: "user" | "assistant" | "tool";
    contentText: string;
    contentJson?: Record<string, unknown>;
    status: string;
  }): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: this.nextId("message"),
      sessionId: input.sessionId,
      runId: input.runId,
      role: input.role,
      orderIndex: this.messages.length + 1,
      contentText: input.contentText,
      contentJson: input.contentJson ?? {},
      status: input.status,
      parentId: null,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(message);
    return message;
  }

  async appendRunEvent(input: { runId: string; eventType: string; eventPhase?: string | null; payloadJson?: Record<string, unknown> }): Promise<AgentRunEvent> {
    const event: AgentRunEvent = {
      id: this.nextId("event"),
      runId: input.runId,
      sequence: this.events.filter((item) => item.runId === input.runId).length + 1,
      eventType: input.eventType,
      eventPhase: input.eventPhase ?? null,
      payloadJson: input.payloadJson ?? {},
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  async markRunStatus(input: { runId: string; status: "SUCCEEDED" | "FAILED"; outputJson?: Record<string, unknown>; errorMessage?: string | null }): Promise<AgentRun> {
    const index = this.runs.findIndex((item) => item.id === input.runId);
    assert.notEqual(index, -1);
    const updated = {
      ...this.runs[index],
      status: input.status,
      outputJson: input.outputJson ?? this.runs[index].outputJson,
      errorMessage: input.errorMessage ?? null,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.runs[index] = updated;
    return updated;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence.toString().padStart(4, "0")}`;
  }
}

test("real agent chat runtime persists user and assistant messages through repository", async () => {
  const repository = new TestConversationRepository();
  const runtime = new RealAgentChatRuntime({
    repository,
    modelAdapter: {
      provider: "test-provider",
      model: "test-model",
      async complete(input) {
        assert.equal(input.messages[0].role, "user");
        assert.equal(input.context?.selectedEntity?.entityId, "sku_1001");
        return {
          content: "这是模型适配器返回的真实 assistant 回复。",
          usageJson: { inputTokens: 12, outputTokens: 8 },
        };
      },
    },
  });

  const result = await runtime.sendMessage({
    sessionKey: "real-chat-session",
    message: "分析这个 SKU 的历史表现",
    context: {
      route: "/sku-health",
      selectedEntity: { entityType: "sku", entityId: "sku_1001", label: "真实 SKU" },
    },
  });

  assert.equal(result.fallbackUsed, false);
  assert.equal(repository.messages.map((item) => item.role).join(","), "user,assistant");
  assert.equal(repository.messages[1].contentText, "这是模型适配器返回的真实 assistant 回复。");
  assert.deepEqual(repository.events.map((item) => item.eventType), ["message.user", "assistant.message"]);
  assert.equal(repository.runs[0].status, "SUCCEEDED");
  assert.equal(repository.runs[0].modelProvider, "test-provider");
  assert.equal(repository.missions[0].subjectId, "sku_1001");
});

test("real agent chat runtime fails closed when persistence or model adapter is missing", async () => {
  const runtime = new RealAgentChatRuntime({});

  await assert.rejects(
    () => runtime.sendMessage({ sessionKey: "missing-runtime", message: "hello" }),
    (error) => {
      assert.ok(error instanceof RealAgentChatConfigurationError);
      assert.deepEqual(error.missing, ["AgentConversationRepository", "AgentModelAdapter"]);
      return true;
    },
  );
});
