import assert from "node:assert/strict";
import test from "node:test";

import {
  PrismaAgentConversationRepository,
  assertAgentConversationPrismaClient,
  type AgentConversationPrismaClient,
} from "../../src/application/foundation/PrismaAgentConversationRepository";
import { RealAgentChatRuntime } from "../../src/application/foundation/RealAgentChatRuntime";

type RecordValue = Record<string, unknown>;

class FakeDelegate {
  readonly calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  readonly records: RecordValue[] = [];

  constructor(private readonly prefix: string) {}

  async create(args: Record<string, unknown>): Promise<RecordValue> {
    this.calls.push({ method: "create", args });
    const data = (args.data ?? {}) as RecordValue;
    const record = this.withDefaults(data);
    this.records.push(record);
    return record;
  }

  async findMany(args: Record<string, unknown> = {}): Promise<RecordValue[]> {
    this.calls.push({ method: "findMany", args });
    const where = (args.where ?? {}) as RecordValue;
    const filtered = this.records.filter((record) => Object.entries(where).every(([key, value]) => record[key] === value));
    return filtered.sort((left, right) => Number(right.orderIndex ?? right.sequence ?? 0) - Number(left.orderIndex ?? left.sequence ?? 0));
  }

  async findUnique(args: Record<string, unknown>): Promise<RecordValue | null> {
    this.calls.push({ method: "findUnique", args });
    const where = (args.where ?? {}) as RecordValue;
    return this.records.find((record) => Object.entries(where).every(([key, value]) => record[key] === value)) ?? null;
  }

  async upsert(args: Record<string, unknown>): Promise<RecordValue> {
    this.calls.push({ method: "upsert", args });
    const where = (args.where ?? {}) as RecordValue;
    const existing = this.records.find((record) => Object.entries(where).every(([key, value]) => record[key] === value));
    if (existing) {
      Object.assign(existing, args.update ?? {});
      return existing;
    }
    const record = this.withDefaults((args.create ?? {}) as RecordValue);
    this.records.push(record);
    return record;
  }

  async update(args: Record<string, unknown>): Promise<RecordValue> {
    this.calls.push({ method: "update", args });
    const where = (args.where ?? {}) as RecordValue;
    const existing = this.records.find((record) => Object.entries(where).every(([key, value]) => record[key] === value));
    assert.ok(existing);
    Object.assign(existing, args.data ?? {});
    existing.updatedAt = new Date("2026-05-24T00:00:01.000Z");
    return existing;
  }

  async count(): Promise<number> {
    this.calls.push({ method: "count", args: {} });
    return this.records.length;
  }

  private withDefaults(data: RecordValue): RecordValue {
    const now = new Date("2026-05-24T00:00:00.000Z");
    return {
      id: `${this.prefix}_${this.records.length + 1}`,
      status: "ACTIVE",
      configJson: {},
      inputJson: {},
      outputJson: {},
      usageJson: {},
      metadataJson: {},
      constraintsJson: {},
      workbenchContextJson: {},
      planJson: {},
      nextActionsJson: {},
      cancelRequested: false,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
  }
}

function fakePrisma() {
  return {
    agentSession: new FakeDelegate("session"),
    agentMission: new FakeDelegate("mission"),
    agentRun: new FakeDelegate("run"),
    agentMessage: new FakeDelegate("message"),
    agentRunEvent: new FakeDelegate("event"),
    agentToolCall: new FakeDelegate("tool"),
    agentReviewGate: new FakeDelegate("gate"),
  } satisfies AgentConversationPrismaClient;
}

test("prisma agent conversation repository writes ordered chat records for real runtime", async () => {
  const prisma = fakePrisma();
  const repository = new PrismaAgentConversationRepository(prisma);
  const runtime = new RealAgentChatRuntime({
    repository,
    modelAdapter: {
      provider: "vercel-ai-sdk",
      model: "test-chat-model",
      async complete() {
        return { content: "模型返回的真实对话内容" };
      },
    },
  });

  const result = await runtime.sendMessage({
    sessionKey: "prisma-chat-session",
    message: "分析 SKU 历史表现",
    context: { route: "/sku-health", selectedEntity: { entityType: "sku", entityId: "sku_real" } },
  });

  assert.equal(result.fallbackUsed, false);
  assert.equal(prisma.agentSession.calls[0].method, "upsert");
  assert.equal(prisma.agentMission.records[0].subjectId, "sku_real");
  assert.equal(prisma.agentRun.records[0].modelProvider, "vercel-ai-sdk");
  assert.deepEqual(prisma.agentMessage.records.map((item) => item.role), ["USER", "ASSISTANT"]);
  assert.deepEqual(prisma.agentMessage.records.map((item) => item.orderIndex), [1, 2]);
  assert.deepEqual(prisma.agentRunEvent.records.map((item) => item.eventType), ["message.user", "assistant.message"]);
  assert.deepEqual(prisma.agentRunEvent.records.map((item) => item.sequence), [1, 2]);
  assert.equal(prisma.agentRun.records[0].status, "DONE");
});

test("prisma agent conversation repository decides review gate with continuation run", async () => {
  const prisma = fakePrisma();
  const repository = new PrismaAgentConversationRepository(prisma);
  const session = await repository.getOrCreateSession({ sessionKey: "review-gate-session", surface: "agent-copilot" });
  const mission = await repository.createMission({ sessionId: session.id, objective: "需要人工确认", sourceSurface: "agent-copilot" });
  const run = await repository.createRun({ sessionId: session.id, missionId: mission.id, modelProvider: "vercel-ai-sdk", modelName: "test-model", inputJson: {} });
  const toolCall = await repository.createToolCall({ runId: run.id, toolName: "generateReport", status: "WAITING_FOR_APPROVAL", riskLevel: "L2", reviewPolicy: "REVIEW_GATE" });
  const gate = await repository.createReviewGate({
    missionId: mission.id,
    runId: run.id,
    toolCallId: toolCall.id,
    reasonCode: "chat_write_tool_requires_review",
    question: "是否允许 Agent 执行 generateReport？",
  });

  const decision = await repository.decideReviewGate(gate.id, { decision: "APPROVE", decidedBy: "ops@example.test", decisionComment: "允许继续" });

  assert.equal(decision.gate.status, "APPROVED");
  assert.equal(decision.gate.decidedBy, "ops@example.test");
  assert.equal(decision.continuationRun.missionId, mission.id);
  assert.equal(decision.continuationRun.sessionId, session.id);
  assert.equal(decision.continuationRun.inputJson.reviewGateId, gate.id);
  assert.equal(decision.event.eventType, "run.continuation_started");
  assert.equal(decision.event.payloadJson.previousRunId, run.id);
});

test("prisma agent conversation client check fails closed when delegates are absent", () => {
  assert.throws(
    () => assertAgentConversationPrismaClient({ agentSession: new FakeDelegate("session") }),
    /agentMission, agentRun, agentMessage, agentRunEvent/,
  );
});
