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

test("prisma agent conversation client check fails closed when delegates are absent", () => {
  assert.throws(
    () => assertAgentConversationPrismaClient({ agentSession: new FakeDelegate("session") }),
    /agentMission, agentRun, agentMessage, agentRunEvent/,
  );
});
