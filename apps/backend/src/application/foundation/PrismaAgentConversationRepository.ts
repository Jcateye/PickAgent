import type { AgentMessage } from "../../domain/entities/AgentMessage";
import type { AgentMission } from "../../domain/entities/AgentMission";
import type { AgentReviewGate } from "../../domain/entities/AgentReviewGate";
import type { AgentRun } from "../../domain/entities/AgentRun";
import type { AgentRunEvent } from "../../domain/entities/AgentRunEvent";
import type { AgentSession } from "../../domain/entities/AgentSession";
import type { AgentToolCall } from "../../domain/entities/AgentToolCall";
import type { AgentConversationRepository } from "./RealAgentChatRuntime";

type PrismaRecord = Record<string, unknown>;

type PrismaDelegate = {
  create(args: Record<string, unknown>): Promise<PrismaRecord>;
  findMany(args?: Record<string, unknown>): Promise<PrismaRecord[]>;
  findUnique(args: Record<string, unknown>): Promise<PrismaRecord | null>;
  upsert(args: Record<string, unknown>): Promise<PrismaRecord>;
  update(args: Record<string, unknown>): Promise<PrismaRecord>;
  count(args?: Record<string, unknown>): Promise<number>;
};

export interface AgentConversationPrismaClient {
  agentSession: PrismaDelegate;
  agentMission: PrismaDelegate;
  agentRun: PrismaDelegate;
  agentMessage: PrismaDelegate;
  agentRunEvent: PrismaDelegate;
  agentToolCall: PrismaDelegate;
  agentReviewGate: PrismaDelegate;
}

export function assertAgentConversationPrismaClient(value: unknown): asserts value is AgentConversationPrismaClient {
  const client = value as Partial<AgentConversationPrismaClient> | null | undefined;
  const required = ["agentSession", "agentMission", "agentRun", "agentMessage", "agentRunEvent", "agentToolCall", "agentReviewGate"] as const;
  const missing = required.filter((delegateName) => !client?.[delegateName]);
  if (missing.length) {
    throw new Error(`Missing Prisma Agent conversation delegates: ${missing.join(", ")}`);
  }
}

export class PrismaAgentConversationRepository implements AgentConversationRepository {
  constructor(private readonly prisma: AgentConversationPrismaClient) {}

  async getOrCreateSession(input: { sessionKey: string; surface: string; title?: string | null }): Promise<AgentSession> {
    const now = new Date();
    const record = await this.prisma.agentSession.upsert({
      where: { sessionKey: input.sessionKey },
      create: {
        sessionKey: input.sessionKey,
        surface: input.surface,
        title: input.title ?? null,
        status: "ACTIVE",
        configJson: {},
        lastActiveAt: now,
      },
      update: {
        surface: input.surface,
        title: input.title ?? null,
        lastActiveAt: now,
      },
    });
    return toSession(record);
  }

  async createMission(input: {
    sessionId: string;
    objective: string;
    sourceSurface: string;
    subjectType?: string | null;
    subjectId?: string | null;
    workbenchContextJson?: Record<string, unknown>;
  }): Promise<AgentMission> {
    const record = await this.prisma.agentMission.create({
      data: {
        sessionId: input.sessionId,
        missionType: "goal_driven",
        objective: input.objective,
        autonomyLevel: "L2_REVIEW_GATED_AGENT",
        status: "RUNNING",
        sourceSurface: input.sourceSurface,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        constraintsJson: {},
        workbenchContextJson: input.workbenchContextJson ?? {},
        planJson: [],
        nextActionsJson: [],
      },
    });
    return toMission(record);
  }

  async createRun(input: { sessionId: string; missionId: string; modelProvider: string; modelName: string; inputJson: Record<string, unknown> }): Promise<AgentRun> {
    const now = new Date();
    const record = await this.prisma.agentRun.create({
      data: {
        sessionId: input.sessionId,
        missionId: input.missionId,
        status: "RUNNING",
        modelProvider: input.modelProvider,
        modelName: input.modelName,
        inputJson: input.inputJson,
        outputJson: {},
        usageJson: {},
        metadataJson: {},
        startedAt: now,
      },
    });
    return toRun(record);
  }

  async appendMessage(input: {
    sessionId: string;
    runId: string | null;
    role: "user" | "assistant" | "tool";
    contentText: string;
    contentJson?: Record<string, unknown>;
    status: string;
  }): Promise<AgentMessage> {
    const latest = await this.prisma.agentMessage.findMany({
      where: { sessionId: input.sessionId },
      orderBy: { orderIndex: "desc" },
      take: 1,
    });
    const orderIndex = Number(latest[0]?.orderIndex ?? 0) + 1;
    const record = await this.prisma.agentMessage.create({
      data: {
        sessionId: input.sessionId,
        runId: input.runId,
        role: input.role.toUpperCase(),
        orderIndex,
        contentText: input.contentText,
        contentJson: input.contentJson ?? {},
        status: input.status,
      },
    });
    return toMessage(record);
  }

  async appendRunEvent(input: { runId: string; eventType: string; eventPhase?: string | null; payloadJson?: Record<string, unknown> }): Promise<AgentRunEvent> {
    const latest = await this.prisma.agentRunEvent.findMany({
      where: { runId: input.runId },
      orderBy: { sequence: "desc" },
      take: 1,
    });
    const sequence = Number(latest[0]?.sequence ?? 0) + 1;
    const record = await this.prisma.agentRunEvent.create({
      data: {
        runId: input.runId,
        sequence,
        eventType: input.eventType,
        eventPhase: input.eventPhase ?? null,
        payloadJson: input.payloadJson ?? {},
      },
    });
    return toRunEvent(record);
  }

  async listMessagesBySessionKey(sessionKey: string, limit: number): Promise<AgentMessage[]> {
    const session = await this.prisma.agentSession.findUnique({
      where: { sessionKey },
    });
    if (!session) return [];
    const records = await this.prisma.agentMessage.findMany({
      where: { sessionId: stringValue(session.id) },
      orderBy: { orderIndex: "desc" },
      take: Math.max(1, Math.min(limit, 100)),
    });
    return records.map(toMessage).sort((left, right) => left.orderIndex - right.orderIndex);
  }

  async listEventsAfter(runId: string, after = 0): Promise<AgentRunEvent[]> {
    const records = await this.prisma.agentRunEvent.findMany({
      where: { runId, sequence: { gt: after } },
      orderBy: { sequence: "asc" },
      take: 200,
    });
    return records.map(toRunEvent);
  }

  async createToolCall(input: {
    runId: string;
    externalToolCallId?: string | null;
    toolName: string;
    status: string;
    riskLevel: string;
    reviewPolicy: string;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
    evidenceRefsJson?: Record<string, unknown>;
    errorMessage?: string | null;
    blockedReason?: string | null;
  }): Promise<AgentToolCall> {
    const now = new Date();
    const record = await this.prisma.agentToolCall.create({
      data: {
        runId: input.runId,
        externalToolCallId: input.externalToolCallId ?? null,
        toolName: input.toolName,
        status: input.status,
        riskLevel: input.riskLevel,
        reviewPolicy: input.reviewPolicy,
        inputJson: input.inputJson ?? {},
        outputJson: input.outputJson ?? {},
        evidenceRefsJson: input.evidenceRefsJson ?? { refs: [] },
        errorMessage: input.errorMessage ?? null,
        blockedReason: input.blockedReason ?? null,
        startedAt: now,
        completedAt: now,
      },
    });
    return toToolCall(record);
  }

  async createReviewGate(input: {
    missionId: string;
    runId: string;
    toolCallId?: string | null;
    reasonCode: string;
    question: string;
    agentRecommendation?: string | null;
    riskIfApproved?: string | null;
    riskIfRejected?: string | null;
    evidenceRefsJson?: Record<string, unknown>;
    reviewItemId?: string | null;
  }): Promise<AgentReviewGate> {
    const record = await this.prisma.agentReviewGate.create({
      data: {
        missionId: input.missionId,
        runId: input.runId,
        toolCallId: input.toolCallId ?? null,
        reviewItemId: input.reviewItemId ?? null,
        status: "PENDING",
        reasonCode: input.reasonCode,
        question: input.question,
        agentRecommendation: input.agentRecommendation ?? null,
        riskIfApproved: input.riskIfApproved ?? null,
        riskIfRejected: input.riskIfRejected ?? null,
        evidenceRefsJson: input.evidenceRefsJson ?? { refs: [] },
      },
    });
    return toReviewGate(record);
  }

  async decideReviewGate(gateId: string, input: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; decidedBy: string; decisionComment?: string | null }): Promise<{ gate: AgentReviewGate; continuationRun: AgentRun; event: AgentRunEvent; approvedToolCall?: AgentToolCall | null }> {
    const gate = await this.prisma.agentReviewGate.findUnique({ where: { id: gateId } });
    if (!gate) throw new Error(`Agent review gate not found: ${gateId}`);
    const currentGate = toReviewGate(gate);
    if (currentGate.status !== "PENDING") throw new Error(`Agent review gate is not pending: ${gateId}`);
    const previousRun = await this.prisma.agentRun.findUnique({ where: { id: currentGate.runId } });
    if (!previousRun) throw new Error(`Agent run not found: ${currentGate.runId}`);
    const approvedToolCall = currentGate.toolCallId
      ? await this.prisma.agentToolCall.findUnique({ where: { id: currentGate.toolCallId } })
      : null;
    const decidedAt = new Date();
    const statusByDecision = {
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      REQUEST_CHANGES: "MODIFIED",
    } as const;
    const updatedGate = await this.prisma.agentReviewGate.update({
      where: { id: gateId },
      data: {
        status: statusByDecision[input.decision],
        decision: input.decision,
        decisionComment: input.decisionComment ?? null,
        decidedBy: input.decidedBy,
        decidedAt,
      },
    });
    const previous = toRun(previousRun);
    const continuationRun = await this.prisma.agentRun.create({
      data: {
        sessionId: previous.sessionId,
        missionId: currentGate.missionId,
        status: "RUNNING",
        modelProvider: previous.modelProvider,
        modelName: previous.modelName,
        inputJson: {
          continuationOfRunId: currentGate.runId,
          reviewGateId: gateId,
          decision: input.decision,
          approvedToolCallId: approvedToolCall ? String(approvedToolCall.id) : null,
          approvedToolName: approvedToolCall ? String(approvedToolCall.toolName) : null,
          approvedToolInputJson: approvedToolCall ? objectValue(approvedToolCall.inputJson) : null,
        },
        outputJson: {},
        usageJson: {},
        metadataJson: {},
        startedAt: decidedAt,
      },
    });
    const latestEvent = (await this.prisma.agentRunEvent.findMany({
      where: { runId: String(continuationRun.id) },
      orderBy: { sequence: "desc" },
    }))[0];
    const event = await this.prisma.agentRunEvent.create({
      data: {
        runId: String(continuationRun.id),
        sequence: Number(latestEvent?.sequence ?? 0) + 1,
        eventType: "run.continuation_started",
        eventPhase: "started",
        payloadJson: { missionId: currentGate.missionId, reviewGateId: gateId, previousRunId: currentGate.runId },
      },
    });
    return { gate: toReviewGate(updatedGate), continuationRun: toRun(continuationRun), event: toRunEvent(event), approvedToolCall: approvedToolCall ? toToolCall(approvedToolCall) : null };
  }

  async markRunStatus(input: { runId: string; status: "SUCCEEDED" | "FAILED"; outputJson?: Record<string, unknown>; errorMessage?: string | null }): Promise<AgentRun> {
    const now = new Date();
    const record = await this.prisma.agentRun.update({
      where: { id: input.runId },
      data: {
        status: input.status === "SUCCEEDED" ? "DONE" : "FAILED",
        outputJson: input.outputJson ?? {},
        errorMessage: input.errorMessage ?? null,
        completedAt: now,
      },
    });
    return toRun(record);
  }
}

function toSession(record: PrismaRecord): AgentSession {
  return {
    id: stringValue(record.id),
    sessionKey: stringValue(record.sessionKey),
    userId: nullableString(record.userId),
    surface: stringValue(record.surface),
    piSessionKey: nullableString(record.piSessionKey),
    piSessionRef: nullableString(record.piSessionRef),
    title: nullableString(record.title),
    status: stringValue(record.status),
    configJson: objectValue(record.configJson),
    lastActiveAt: isoOrNull(record.lastActiveAt),
    createdAt: isoValue(record.createdAt),
    updatedAt: isoValue(record.updatedAt),
  };
}

function toMission(record: PrismaRecord): AgentMission {
  return {
    id: stringValue(record.id),
    sessionId: stringValue(record.sessionId),
    missionType: stringValue(record.missionType),
    objective: stringValue(record.objective),
    autonomyLevel: stringValue(record.autonomyLevel),
    status: stringValue(record.status),
    sourceSurface: stringValue(record.sourceSurface),
    subjectType: nullableString(record.subjectType),
    subjectId: nullableString(record.subjectId),
    constraintsJson: objectValue(record.constraintsJson),
    workbenchContextJson: objectValue(record.workbenchContextJson),
    planJson: objectValue(record.planJson),
    nextActionsJson: objectValue(record.nextActionsJson),
    createdBy: nullableString(record.createdBy),
    completedAt: isoOrNull(record.completedAt),
    canceledAt: isoOrNull(record.canceledAt),
    createdAt: isoValue(record.createdAt),
    updatedAt: isoValue(record.updatedAt),
  };
}

function toRun(record: PrismaRecord): AgentRun {
  return {
    id: stringValue(record.id),
    missionId: stringValue(record.missionId),
    sessionId: stringValue(record.sessionId),
    piRunId: nullableString(record.piRunId),
    workflowRunId: nullableString(record.workflowRunId),
    status: stringValue(record.status),
    modelProvider: nullableString(record.modelProvider),
    modelName: nullableString(record.modelName),
    inputJson: objectValue(record.inputJson),
    outputJson: objectValue(record.outputJson),
    errorMessage: nullableString(record.errorMessage),
    timeoutMs: typeof record.timeoutMs === "number" ? record.timeoutMs : null,
    cancelRequested: Boolean(record.cancelRequested),
    usageJson: objectValue(record.usageJson),
    metadataJson: objectValue(record.metadataJson),
    startedAt: isoOrNull(record.startedAt),
    completedAt: isoOrNull(record.completedAt),
    createdAt: isoValue(record.createdAt),
    updatedAt: isoValue(record.updatedAt),
  };
}

function toMessage(record: PrismaRecord): AgentMessage {
  return {
    id: stringValue(record.id),
    sessionId: stringValue(record.sessionId),
    runId: nullableString(record.runId),
    role: stringValue(record.role).toLowerCase(),
    orderIndex: Number(record.orderIndex),
    contentText: nullableString(record.contentText),
    contentJson: objectValue(record.contentJson),
    status: stringValue(record.status),
    parentId: nullableString(record.parentId),
    createdAt: isoValue(record.createdAt),
  };
}

function toRunEvent(record: PrismaRecord): AgentRunEvent {
  return {
    id: stringValue(record.id),
    runId: stringValue(record.runId),
    sequence: Number(record.sequence),
    eventType: stringValue(record.eventType),
    eventPhase: nullableString(record.eventPhase),
    payloadJson: objectValue(record.payloadJson),
    createdAt: isoValue(record.createdAt),
  };
}

function toToolCall(record: PrismaRecord): AgentToolCall {
  return {
    id: stringValue(record.id),
    runId: stringValue(record.runId),
    externalToolCallId: nullableString(record.externalToolCallId),
    workflowStepId: nullableString(record.workflowStepId),
    toolName: stringValue(record.toolName),
    status: stringValue(record.status),
    riskLevel: stringValue(record.riskLevel),
    reviewPolicy: stringValue(record.reviewPolicy),
    inputJson: objectValue(record.inputJson),
    outputJson: objectValue(record.outputJson),
    evidenceRefsJson: objectValue(record.evidenceRefsJson),
    errorMessage: nullableString(record.errorMessage),
    blockedReason: nullableString(record.blockedReason),
    startedAt: isoOrNull(record.startedAt),
    completedAt: isoOrNull(record.completedAt),
    createdAt: isoValue(record.createdAt),
    updatedAt: isoValue(record.updatedAt),
  };
}

function toReviewGate(record: PrismaRecord): AgentReviewGate {
  return {
    id: stringValue(record.id),
    missionId: stringValue(record.missionId),
    runId: stringValue(record.runId),
    toolCallId: nullableString(record.toolCallId),
    reviewItemId: nullableString(record.reviewItemId),
    status: stringValue(record.status),
    reasonCode: stringValue(record.reasonCode),
    question: stringValue(record.question),
    agentRecommendation: nullableString(record.agentRecommendation),
    riskIfApproved: nullableString(record.riskIfApproved),
    riskIfRejected: nullableString(record.riskIfRejected),
    evidenceRefsJson: objectValue(record.evidenceRefsJson),
    decision: nullableString(record.decision),
    decisionComment: nullableString(record.decisionComment),
    decidedBy: nullableString(record.decidedBy),
    decidedAt: isoOrNull(record.decidedAt),
    createdAt: isoValue(record.createdAt),
    updatedAt: isoValue(record.updatedAt),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isoValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : new Date(0).toISOString();
}

function isoOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}
