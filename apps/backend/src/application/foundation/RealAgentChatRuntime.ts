import type { AgentMessage } from "../../domain/entities/AgentMessage";
import type { AgentMission } from "../../domain/entities/AgentMission";
import type { AgentReviewGate } from "../../domain/entities/AgentReviewGate";
import type { AgentRun } from "../../domain/entities/AgentRun";
import type { AgentRunEvent } from "../../domain/entities/AgentRunEvent";
import type { AgentSession } from "../../domain/entities/AgentSession";
import type { AgentToolCall } from "../../domain/entities/AgentToolCall";

export const REAL_AGENT_CHAT_NOT_CONFIGURED = "AGENT.REAL_CHAT_NOT_CONFIGURED" as const;

export interface RealAgentChatContext {
  route?: string;
  pageTitle?: string;
  selectedEntity?: {
    entityType: string;
    entityId: string;
    label?: string;
  };
  visibleFilters?: Record<string, unknown>;
  visibleColumns?: string[];
}

export interface SendRealAgentChatMessageInput {
  sessionKey: string;
  message: string;
  context?: RealAgentChatContext;
}

export interface AgentConversationRepository {
  getOrCreateSession(input: {
    sessionKey: string;
    surface: string;
    title?: string | null;
  }): Promise<AgentSession>;
  createMission(input: {
    sessionId: string;
    objective: string;
    sourceSurface: string;
    subjectType?: string | null;
    subjectId?: string | null;
    workbenchContextJson?: Record<string, unknown>;
  }): Promise<AgentMission>;
  createRun(input: {
    sessionId: string;
    missionId: string;
    modelProvider: string;
    modelName: string;
    inputJson: Record<string, unknown>;
  }): Promise<AgentRun>;
  appendMessage(input: {
    sessionId: string;
    runId: string | null;
    role: "user" | "assistant" | "tool";
    contentText: string;
    contentJson?: Record<string, unknown>;
    status: string;
  }): Promise<AgentMessage>;
  appendRunEvent(input: {
    runId: string;
    eventType: string;
    eventPhase?: string | null;
    payloadJson?: Record<string, unknown>;
  }): Promise<AgentRunEvent>;
  listMessagesBySessionKey(sessionKey: string, limit: number): Promise<AgentMessage[]>;
  listEventsAfter(runId: string, after?: number): Promise<AgentRunEvent[]>;
  createToolCall(input: {
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
  }): Promise<AgentToolCall>;
  createReviewGate(input: {
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
  }): Promise<AgentReviewGate>;
  markRunStatus(input: {
    runId: string;
    status: "SUCCEEDED" | "FAILED";
    outputJson?: Record<string, unknown>;
    errorMessage?: string | null;
  }): Promise<AgentRun>;
}

export interface AgentModelAdapterInput {
  session: AgentSession;
  mission: AgentMission;
  run: AgentRun;
  messages: AgentMessage[];
  context?: RealAgentChatContext;
  executeTool?: AgentConversationToolExecutor;
}

export interface AgentModelAdapterOutput {
  content: string;
  usageJson?: Record<string, unknown>;
  metadataJson?: Record<string, unknown>;
  toolExecutions?: AgentConversationToolExecution[];
}

export interface AgentModelAdapter {
  provider: string;
  model: string;
  complete(input: AgentModelAdapterInput): Promise<AgentModelAdapterOutput>;
}

export interface RealAgentChatRuntimeOptions {
  repository?: AgentConversationRepository;
  modelAdapter?: AgentModelAdapter;
  toolExecutor?: AgentConversationToolExecutor;
}

export interface RealAgentChatRuntimeResponse {
  mission: AgentMission;
  run: AgentRun;
  userMessage: AgentMessage;
  assistantMessage: AgentMessage;
  events: AgentRunEvent[];
  toolExecutions: AgentConversationToolExecution[];
  fallbackUsed: false;
}

export interface AgentConversationEvidenceRef {
  id: string;
  evidenceType: "snapshot" | "rule" | "simulation" | "review_gate" | "tool_result";
  label: string;
  summary: string;
  entityType?: string;
  entityId?: string;
}

export interface AgentConversationLinkedEntity {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  reason: string;
  sourceType: "mission" | "run" | "message" | "tool_call" | "review_gate";
  sourceId: string;
}

export interface AgentConversationToolExecution {
  toolCall: AgentToolCall;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED_BY_POLICY" | "WAITING_FOR_APPROVAL";
  summary: string;
  data: unknown;
  evidenceRefs: AgentConversationEvidenceRef[];
  linkedEntities: AgentConversationLinkedEntity[];
  reviewGate: AgentReviewGate | null;
}

export type AgentConversationToolExecutor = (input: {
  run: AgentRun;
  mission: AgentMission;
  toolName: string;
  inputJson: Record<string, unknown>;
  externalToolCallId?: string | null;
}) => Promise<AgentConversationToolExecution>;

export class RealAgentChatConfigurationError extends Error {
  readonly code = REAL_AGENT_CHAT_NOT_CONFIGURED;

  constructor(readonly missing: string[]) {
    super(`Real Agent chat is not configured: ${missing.join(", ")}`);
    this.name = "RealAgentChatConfigurationError";
  }
}

export class RealAgentChatRuntime {
  constructor(private readonly options: RealAgentChatRuntimeOptions) {}

  private configured(): { repository: AgentConversationRepository; modelAdapter: AgentModelAdapter } {
    const repository = this.options.repository;
    const modelAdapter = this.options.modelAdapter;
    const missing: string[] = [];
    if (!repository) missing.push("AgentConversationRepository");
    if (!modelAdapter) missing.push("AgentModelAdapter");
    if (!repository || !modelAdapter) throw new RealAgentChatConfigurationError(missing);
    return {
      repository,
      modelAdapter,
    };
  }

  async sendMessage(input: SendRealAgentChatMessageInput): Promise<RealAgentChatRuntimeResponse> {
    const sessionKey = input.sessionKey.trim();
    const message = input.message.trim();
    if (!sessionKey || !message) {
      throw new Error("sessionKey and message are required");
    }

    const { repository, modelAdapter } = this.configured();
    const session = await repository.getOrCreateSession({
      sessionKey,
      surface: "agent-copilot",
      title: message.slice(0, 80),
    });
    const mission = await repository.createMission({
      sessionId: session.id,
      objective: message,
      sourceSurface: "agent-copilot",
      subjectType: input.context?.selectedEntity?.entityType ?? null,
      subjectId: input.context?.selectedEntity?.entityId ?? null,
      workbenchContextJson: serializeContext(input.context),
    });
    const run = await repository.createRun({
      sessionId: session.id,
      missionId: mission.id,
      modelProvider: modelAdapter.provider,
      modelName: modelAdapter.model,
      inputJson: {
        message,
        context: serializeContext(input.context),
      },
    });
    const userMessage = await repository.appendMessage({
      sessionId: session.id,
      runId: run.id,
      role: "user",
      contentText: message,
      contentJson: {},
      status: "completed",
    });
    const userEvent = await repository.appendRunEvent({
      runId: run.id,
      eventType: "message.user",
      eventPhase: "received",
      payloadJson: { messageId: userMessage.id },
    });

    try {
      const recentMessages = await repository.listMessagesBySessionKey(sessionKey, 20);
      const toolExecutions: AgentConversationToolExecution[] = [];
      const completion = await modelAdapter.complete({
        session,
        mission,
        run,
        messages: recentMessages.length ? recentMessages : [userMessage],
        context: input.context,
        executeTool: this.options.toolExecutor
          ? async (toolInput) => {
              return this.options.toolExecutor!({
                ...toolInput,
                run,
                mission,
              });
            }
          : undefined,
      });
      const assistantMessage = await repository.appendMessage({
        sessionId: session.id,
        runId: run.id,
        role: "assistant",
        contentText: completion.content,
        contentJson: {
          usageJson: completion.usageJson ?? {},
          metadataJson: completion.metadataJson ?? {},
          toolExecutions: summarizeToolExecutions(completion.toolExecutions ?? toolExecutions),
        },
        status: "completed",
      });
      const assistantEvent = await repository.appendRunEvent({
        runId: run.id,
        eventType: "assistant.message",
        eventPhase: "completed",
        payloadJson: {
          messageId: assistantMessage.id,
          usageJson: completion.usageJson ?? {},
          metadataJson: completion.metadataJson ?? {},
          toolCallIds: (completion.toolExecutions ?? toolExecutions).map((item) => item.toolCall.id),
        },
      });
      const completedRun = await repository.markRunStatus({
        runId: run.id,
        status: "SUCCEEDED",
        outputJson: {
          assistantMessageId: assistantMessage.id,
          usageJson: completion.usageJson ?? {},
          toolCallIds: (completion.toolExecutions ?? toolExecutions).map((item) => item.toolCall.id),
        },
      });
      const events = await repository.listEventsAfter(run.id, 0);

      return {
        mission,
        run: completedRun,
        userMessage,
        assistantMessage,
        events: events.length ? events : [userEvent, assistantEvent],
        toolExecutions: completion.toolExecutions ?? toolExecutions,
        fallbackUsed: false,
      };
    } catch (error) {
      await repository.appendRunEvent({
        runId: run.id,
        eventType: "assistant.error",
        eventPhase: "failed",
        payloadJson: { message: error instanceof Error ? error.message : "Agent model adapter failed" },
      });
      await repository.markRunStatus({
        runId: run.id,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Agent model adapter failed",
      });
      throw error;
    }
  }
}

function summarizeToolExecutions(executions: AgentConversationToolExecution[]): Record<string, unknown>[] {
  return executions.map((execution) => ({
    toolCallId: execution.toolCall.id,
    toolName: execution.toolCall.toolName,
    status: execution.status,
    summary: execution.summary,
    evidenceRefIds: execution.evidenceRefs.map((ref) => ref.id),
    linkedEntityIds: execution.linkedEntities.map((entity) => entity.id),
    reviewGateId: execution.reviewGate?.id ?? null,
  }));
}

export function serializeContext(context?: RealAgentChatContext): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return {
    route: context.route,
    pageTitle: context.pageTitle,
    selectedEntity: context.selectedEntity,
    visibleFilters: context.visibleFilters ?? {},
    visibleColumns: context.visibleColumns ?? [],
  };
}
