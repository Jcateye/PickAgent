import type { AgentMission } from "../../domain/entities/AgentMission";
import type { AgentReviewGate } from "../../domain/entities/AgentReviewGate";
import type { AgentRun } from "../../domain/entities/AgentRun";
import type { AgentRunEvent } from "../../domain/entities/AgentRunEvent";
import type { AgentSession } from "../../domain/entities/AgentSession";
import type { AgentToolCall } from "../../domain/entities/AgentToolCall";
import { createBusinessFoundationRuntime, type AgentToolRegistry } from "./BusinessFoundationServices";
import { createP0RuntimeConfig, P0_PRODUCTION_TOOL_ALLOWLIST, P0_RUNTIME_TOOL_DENYLIST, redactSensitiveText, redactSensitiveValue, type P0RuntimeConfig } from "./P0AuthBoundaryRuntimeConfig";

export type AgentRunStatus = "QUEUED" | "RUNNING" | "WAITING_REVIEW" | "SUCCEEDED" | "FAILED" | "CANCELED";
export type AgentPermission = "ALLOW" | "REVIEW_REQUIRED" | "DENY";
export type AgentRiskLevel = "L0" | "L1" | "L2" | "L3";
export type AgentReviewPolicy = "AUTO_ALLOW" | "REVIEW_GATE" | "DENY";
export type AgentToolStatus = "SUCCEEDED" | "BLOCKED" | "REVIEW_REQUIRED" | "FAILED";
export type AgentReviewDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

export interface EvidenceRef {
  type: "agent_event" | "tool_call" | "review_gate" | "workflow_step" | "policy";
  entityId: string;
  label: string;
  summary: string;
}

export interface AppendAgentRunEventInput {
  runId: string;
  eventType: string;
  eventPhase?: string | null;
  payloadJson?: Record<string, unknown>;
}

export interface AgentEventStore {
  append(input: AppendAgentRunEventInput): AgentRunEvent;
  listAfter(runId: string, after?: number): AgentRunEvent[];
  markRunStatus(runId: string, status: AgentRunStatus, outputJson?: Record<string, unknown>, errorMessage?: string | null): AgentRun;
  linkWorkflowStep(runId: string, workflowStepId: string): AgentRun;
}

export interface CreateAgentMissionInput {
  sessionKey: string;
  objective: string;
  missionType?: string;
  autonomyLevel?: string;
  sourceSurface?: string;
  subjectType?: string | null;
  subjectId?: string | null;
  constraintsJson?: Record<string, unknown>;
  workbenchContextJson?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface StartAgentRunInput {
  modelProvider?: string | null;
  modelName?: string | null;
  inputJson?: Record<string, unknown>;
  timeoutMs?: number | null;
}

export interface ExecuteAgentToolInput {
  runId: string;
  toolName: string;
  inputJson?: Record<string, unknown>;
  externalToolCallId?: string | null;
}

export interface AgentToolExecutionResult {
  toolCall: AgentToolCall;
  permission: AgentPermission;
  riskLevel: AgentRiskLevel;
  reviewPolicy: AgentReviewPolicy;
  evidenceRefs: EvidenceRef[];
  reviewGate?: AgentReviewGate;
}

export interface DecideAgentReviewGateInput {
  decision: AgentReviewDecision;
  decidedBy: string;
  decisionComment?: string;
}

export interface AgentReviewGateDecisionResult {
  gate: AgentReviewGate;
  continuationRun: AgentRun;
  event: AgentRunEvent;
}

export interface AgentMissionCreatedDto {
  session: AgentSession;
  mission: AgentMission;
}

export class AgentEventStoreState {
  readonly sessions = new Map<string, AgentSession>();
  readonly sessionsByKey = new Map<string, AgentSession>();
  readonly missions = new Map<string, AgentMission>();
  readonly runs = new Map<string, AgentRun>();
  readonly eventsByRun = new Map<string, AgentRunEvent[]>();
  readonly toolCalls = new Map<string, AgentToolCall>();
  readonly reviewGates = new Map<string, AgentReviewGate>();
}

let agentSequence = 0;

function nextAgentId(prefix: string): string {
  agentSequence += 1;
  return `${prefix}_${agentSequence.toString().padStart(4, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function metadata(input?: Record<string, unknown>): Record<string, unknown> {
  return input ?? {};
}

export class AgentRepository {
  constructor(private readonly state: AgentEventStoreState) {}

  getOrCreateSession(input: { sessionKey: string; userId?: string | null; surface?: string; title?: string | null }): AgentSession {
    const existing = this.state.sessionsByKey.get(input.sessionKey);
    if (existing) return existing;
    const now = nowIso();
    const session: AgentSession = {
      id: nextAgentId("agent_session"),
      sessionKey: input.sessionKey,
      userId: input.userId ?? null,
      surface: input.surface ?? "agent-copilot",
      piSessionKey: null,
      piSessionRef: null,
      title: input.title ?? null,
      status: "ACTIVE",
      configJson: {},
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.sessions.set(session.id, session);
    this.state.sessionsByKey.set(session.sessionKey, session);
    return session;
  }

  createMission(session: AgentSession, input: CreateAgentMissionInput): AgentMission {
    const now = nowIso();
    const mission: AgentMission = {
      id: nextAgentId("agent_mission"),
      sessionId: session.id,
      missionType: input.missionType ?? "goal_driven",
      objective: input.objective,
      autonomyLevel: input.autonomyLevel ?? "review_required",
      status: "ACTIVE",
      sourceSurface: input.sourceSurface ?? "agent-copilot",
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      constraintsJson: metadata(input.constraintsJson),
      workbenchContextJson: metadata(input.workbenchContextJson),
      planJson: { steps: [] },
      nextActionsJson: { items: ["start_run"] },
      createdBy: input.createdBy ?? null,
      completedAt: null,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.missions.set(mission.id, mission);
    return mission;
  }

  getMission(id: string): AgentMission | null {
    return this.state.missions.get(id) ?? null;
  }

  createRun(missionId: string, input: StartAgentRunInput & { status?: AgentRunStatus; workflowRunId?: string | null }): AgentRun {
    const mission = this.getMission(missionId);
    if (!mission) throw new Error(`Agent mission not found: ${missionId}`);
    const now = nowIso();
    const run: AgentRun = {
      id: nextAgentId("agent_run"),
      missionId,
      sessionId: mission.sessionId,
      piRunId: null,
      workflowRunId: input.workflowRunId ?? null,
      status: input.status ?? "RUNNING",
      modelProvider: input.modelProvider ?? null,
      modelName: input.modelName ?? null,
      inputJson: metadata(input.inputJson),
      outputJson: {},
      errorMessage: null,
      timeoutMs: input.timeoutMs ?? null,
      cancelRequested: false,
      usageJson: {},
      metadataJson: {},
      startedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.runs.set(run.id, run);
    this.state.eventsByRun.set(run.id, []);
    return run;
  }

  getRun(id: string): AgentRun | null {
    return this.state.runs.get(id) ?? null;
  }

  saveRun(run: AgentRun): AgentRun {
    const updated = { ...run, updatedAt: nowIso() };
    this.state.runs.set(updated.id, updated);
    return updated;
  }

  saveToolCall(toolCall: AgentToolCall): AgentToolCall {
    this.state.toolCalls.set(toolCall.id, toolCall);
    return toolCall;
  }

  createReviewGate(input: {
    missionId: string;
    runId: string;
    toolCallId?: string | null;
    reasonCode: string;
    question: string;
    agentRecommendation?: string | null;
    riskIfApproved?: string | null;
    riskIfRejected?: string | null;
    evidenceRefs: EvidenceRef[];
  }): AgentReviewGate {
    const now = nowIso();
    const gate: AgentReviewGate = {
      id: nextAgentId("agent_gate"),
      missionId: input.missionId,
      runId: input.runId,
      toolCallId: input.toolCallId ?? null,
      reviewItemId: null,
      status: "OPEN",
      reasonCode: input.reasonCode,
      question: input.question,
      agentRecommendation: input.agentRecommendation ?? null,
      riskIfApproved: input.riskIfApproved ?? null,
      riskIfRejected: input.riskIfRejected ?? null,
      evidenceRefsJson: { refs: input.evidenceRefs },
      decision: null,
      decisionComment: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.reviewGates.set(gate.id, gate);
    return gate;
  }

  getReviewGate(id: string): AgentReviewGate | null {
    return this.state.reviewGates.get(id) ?? null;
  }

  saveReviewGate(gate: AgentReviewGate): AgentReviewGate {
    const updated = { ...gate, updatedAt: nowIso() };
    this.state.reviewGates.set(updated.id, updated);
    return updated;
  }
}

export class InMemoryAgentEventStore implements AgentEventStore {
  constructor(private readonly repository: AgentRepository, private readonly state: AgentEventStoreState) {}

  append(input: AppendAgentRunEventInput): AgentRunEvent {
    if (!this.repository.getRun(input.runId)) throw new Error(`Agent run not found: ${input.runId}`);
    const events = this.state.eventsByRun.get(input.runId) ?? [];
    const event: AgentRunEvent = {
      id: nextAgentId("agent_event"),
      runId: input.runId,
      sequence: events.length + 1,
      eventType: input.eventType,
      eventPhase: input.eventPhase ?? null,
      payloadJson: metadata(input.payloadJson),
      createdAt: nowIso(),
    };
    events.push(event);
    this.state.eventsByRun.set(input.runId, events);
    return event;
  }

  listAfter(runId: string, after = 0): AgentRunEvent[] {
    return (this.state.eventsByRun.get(runId) ?? []).filter((event) => event.sequence > after).sort((left, right) => left.sequence - right.sequence);
  }

  markRunStatus(runId: string, status: AgentRunStatus, outputJson?: Record<string, unknown>, errorMessage?: string | null): AgentRun {
    const run = this.repository.getRun(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);
    const terminal = status === "SUCCEEDED" || status === "FAILED" || status === "CANCELED";
    const updated = this.repository.saveRun({
      ...run,
      status,
      outputJson: outputJson ?? run.outputJson,
      errorMessage: errorMessage ?? run.errorMessage,
      completedAt: terminal ? nowIso() : run.completedAt,
    });
    this.append({ runId, eventType: "run.status_changed", eventPhase: status, payloadJson: { status, errorMessage: updated.errorMessage } });
    return updated;
  }

  linkWorkflowStep(runId: string, workflowStepId: string): AgentRun {
    const run = this.repository.getRun(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);
    const metadataJson = { ...run.metadataJson, workflowStepId };
    const updated = this.repository.saveRun({ ...run, metadataJson });
    this.append({ runId, eventType: "run.workflow_step_linked", eventPhase: "linked", payloadJson: { workflowStepId } });
    return updated;
  }
}

interface ToolPolicyDecision {
  permission: AgentPermission;
  riskLevel: AgentRiskLevel;
  reviewPolicy: AgentReviewPolicy;
  reasonCode: string;
  blockedReason?: string;
}

export class AgentToolPolicy {
  private readonly lowRiskTools: Set<string>;
  private readonly reviewRequiredTools = new Set(["createreviewitems"]);
  private readonly deniedExactNames: Set<string>;
  private readonly deniedPatterns = [/^coding(?:\.|$)/i, /^file(?:\.|$)/i, /^bash(?:\.|$)/i, /direct[\s_-]?sql/i, /credential/i, /cookie/i, /token/i, /jwt/i, /sso/i, /secret/i, /api[_\s-]?key/i];

  constructor(config: Pick<P0RuntimeConfig, "productionToolAllowlist" | "runtimeToolDenylist"> = { productionToolAllowlist: P0_PRODUCTION_TOOL_ALLOWLIST, runtimeToolDenylist: P0_RUNTIME_TOOL_DENYLIST }) {
    this.lowRiskTools = new Set(config.productionToolAllowlist.map((tool) => canonicalizeToolName(tool).toLowerCase()));
    this.deniedExactNames = new Set([...config.runtimeToolDenylist.map((tool) => tool.toLowerCase()), "direct_sql", "credential_access"]);
  }

  decide(toolName: string): ToolPolicyDecision {
    const normalized = canonicalizeToolName(toolName).trim().toLowerCase();
    if (!normalized) return this.deny("empty_tool_name", "toolName is required");
    if (this.deniedExactNames.has(normalized) || this.deniedPatterns.some((pattern) => pattern.test(normalized))) {
      return this.deny("dangerous_tool_denied", `${toolName} is outside AgentToolExecutor policy`);
    }
    if (this.lowRiskTools.has(normalized)) {
      return { permission: "ALLOW", riskLevel: "L1", reviewPolicy: "AUTO_ALLOW", reasonCode: "registered_low_risk_tool" };
    }
    if (this.reviewRequiredTools.has(normalized)) {
      return { permission: "REVIEW_REQUIRED", riskLevel: "L2", reviewPolicy: "REVIEW_GATE", reasonCode: "review_gate_required_tool" };
    }
    return this.deny("unregistered_tool_denied", `${toolName} is not registered`);
  }

  private deny(reasonCode: string, blockedReason: string): ToolPolicyDecision {
    return { permission: "DENY", riskLevel: "L3", reviewPolicy: "DENY", reasonCode, blockedReason };
  }
}

export class AgentToolExecutor {
  constructor(
    private readonly repository: AgentRepository,
    private readonly eventStore: AgentEventStore,
    private readonly agentToolRegistry: AgentToolRegistry,
    private readonly policy = new AgentToolPolicy(),
  ) {}

  execute(input: ExecuteAgentToolInput): AgentToolExecutionResult {
    const run = this.repository.getRun(input.runId);
    if (!run) throw new Error(`Agent run not found: ${input.runId}`);
    const startedAt = nowIso();
    const requestedToolName = input.toolName;
    const toolName = canonicalizeToolName(requestedToolName);
    const decision = this.policy.decide(toolName);
    const toolCallId = nextAgentId("agent_tool");
    const policyEvidence: EvidenceRef = {
      type: "policy",
      entityId: decision.reasonCode,
      label: "ToolPolicy",
      summary: redactSensitiveText(decision.blockedReason ?? `tool ${toolName} matched ${decision.reasonCode}`),
    };
    let reviewGate: AgentReviewGate | undefined;
    let toolResult: unknown = undefined;
    let toolStatus: AgentToolStatus = "BLOCKED";
    let errorMessage: string | null = null;
    const evidenceRefs: EvidenceRef[] = [policyEvidence];

    if (decision.permission === "ALLOW") {
      const execution = this.agentToolRegistry.execute(toolName as never, input.inputJson ?? {});
      toolResult = execution.result ?? {};
      evidenceRefs.push(...toPolicyEvidenceRefs(execution.evidence));
      errorMessage = execution.status === "FAILED" ? execution.trace.map((item) => item.summary).join("；") : null;
      toolStatus = execution.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED";
    } else if (decision.permission === "REVIEW_REQUIRED") {
      reviewGate = this.repository.createReviewGate({
        missionId: run.missionId,
        runId: run.id,
        toolCallId,
        reasonCode: decision.reasonCode,
        question: "是否允许创建 L2 Review items？",
        agentRecommendation: "建议先进入 Review Gate，由人工确认后再创建正式 Review item。",
        riskIfApproved: "会创建新的 Review item，把后续业务动作转交 Review 工作台。",
        riskIfRejected: "本次 run 停留在建议态，不会写入新的 Review item。",
        evidenceRefs,
      });
      evidenceRefs.push({
        type: "review_gate",
        entityId: reviewGate.id,
        label: "Review Gate",
        summary: "L2 tool requires human approval before write-side review item creation",
      });
      toolStatus = "REVIEW_REQUIRED";
      this.eventStore.markRunStatus(run.id, "WAITING_REVIEW");
      this.eventStore.append({
        runId: run.id,
        eventType: "review_gate.opened",
        eventPhase: "opened",
        payloadJson: { gateId: reviewGate.id, toolCallId, toolName },
      });
    }

    const toolCall: AgentToolCall = {
      id: toolCallId,
      runId: input.runId,
      externalToolCallId: input.externalToolCallId ?? null,
      workflowStepId: null,
      toolName,
      status: toolStatus,
      riskLevel: decision.riskLevel,
      reviewPolicy: decision.reviewPolicy,
      inputJson: metadata(redactSensitiveValue({ requestedToolName, ...(input.inputJson ?? {}) }) as Record<string, unknown>),
      outputJson: decision.permission === "ALLOW" ? metadata(redactSensitiveValue({ ok: toolStatus === "SUCCEEDED", result: toolResult, summary: summarizeToolResult(toolResult) }) as Record<string, unknown>) : {},
      evidenceRefsJson: { refs: evidenceRefs },
      errorMessage,
      blockedReason: decision.permission === "DENY" ? decision.blockedReason ?? null : null,
      startedAt,
      completedAt: nowIso(),
      createdAt: startedAt,
      updatedAt: nowIso(),
    };
    this.repository.saveToolCall(toolCall);
    this.eventStore.append({
      runId: input.runId,
      eventType: "tool.call_recorded",
      eventPhase: toolCall.status,
      payloadJson: {
        toolCallId,
        toolName,
        requestedToolName,
        permission: decision.permission,
        riskLevel: decision.riskLevel,
        reviewPolicy: decision.reviewPolicy,
        evidenceRefs: redactSensitiveValue(evidenceRefs),
        reviewGateId: reviewGate?.id ?? null,
        outputSummary: redactSensitiveText(summarizeToolResult(toolResult)),
      },
    });
    return { toolCall, permission: decision.permission, riskLevel: decision.riskLevel, reviewPolicy: decision.reviewPolicy, evidenceRefs, reviewGate };
  }
}

export class MinimalPiAgentLoopAdapter {
  readonly provider = "pi";
  readonly contractVersion = "agent-run-events.v1";
  readonly availableTools: readonly string[];
  readonly disabledRuntimeTools: readonly string[];

  constructor(
    private readonly agentService: FinalAgentService,
    private readonly eventStore: AgentEventStore,
    private readonly runtimeConfig: P0RuntimeConfig = createP0RuntimeConfig(),
  ) {
    this.availableTools = runtimeConfig.productionToolAllowlist;
    this.disabledRuntimeTools = runtimeConfig.runtimeToolDenylist;
    if (runtimeConfig.mode === "production" && runtimeConfig.allowDevAuthFallback) {
      throw new Error("Pi production adapter cannot start with dev auth fallback");
    }
  }

  startMission(input: CreateAgentMissionInput): AgentMissionCreatedDto & { run: AgentRun } {
    const created = this.agentService.createMission(input);
    const run = this.agentService.startRun(created.mission.id, {
      modelProvider: "pi",
      modelName: "pi-tool-policy-poc",
      inputJson: {
        objective: input.objective,
        availableTools: [...this.availableTools],
        disabledRuntimeTools: [...this.disabledRuntimeTools],
        runtimeMode: this.runtimeConfig.mode,
      },
    });
    this.eventStore.append({
      runId: run.id,
      eventType: "pi.adapter.started",
      eventPhase: "started",
      payloadJson: { availableTools: [...this.availableTools], disabledRuntimeTools: [...this.disabledRuntimeTools], runtimeMode: this.runtimeConfig.mode },
    });
    return { ...created, run };
  }

  executeTool(runId: string, toolName: string, inputJson?: Record<string, unknown>): AgentToolExecutionResult {
    return this.agentService.executeTool({ runId, toolName, inputJson });
  }
}

export class FinalAgentService {
  constructor(private readonly repository: AgentRepository, private readonly eventStore: AgentEventStore, private readonly toolExecutor: AgentToolExecutor) {}

  createMission(input: CreateAgentMissionInput): AgentMissionCreatedDto {
    if (!input.sessionKey || !input.objective) throw new Error("sessionKey and objective are required");
    const session = this.repository.getOrCreateSession({ sessionKey: input.sessionKey, surface: input.sourceSurface, title: input.objective });
    const mission = this.repository.createMission(session, input);
    return { session, mission };
  }

  startRun(missionId: string, input: StartAgentRunInput = {}): AgentRun {
    const run = this.repository.createRun(missionId, input);
    this.eventStore.append({ runId: run.id, eventType: "run.started", eventPhase: "started", payloadJson: { missionId, input: input.inputJson ?? {} } });
    return run;
  }

  listEvents(runId: string, after = 0): AgentRunEvent[] {
    return this.eventStore.listAfter(runId, after);
  }

  executeTool(input: ExecuteAgentToolInput): AgentToolExecutionResult {
    return this.toolExecutor.execute(input);
  }

  decideReviewGate(gateId: string, input: DecideAgentReviewGateInput): AgentReviewGateDecisionResult {
    if (!input.decision || !input.decidedBy) throw new Error("decision and decidedBy are required");
    const gate = this.repository.getReviewGate(gateId);
    if (!gate) throw new Error(`Agent review gate not found: ${gateId}`);
    const decidedAt = nowIso();
    const updatedGate = this.repository.saveReviewGate({
      ...gate,
      status: input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED",
      decision: input.decision,
      decisionComment: input.decisionComment ?? null,
      decidedBy: input.decidedBy,
      decidedAt,
    });
    this.eventStore.append({
      runId: gate.runId,
      eventType: "review_gate.decided",
      eventPhase: updatedGate.status,
      payloadJson: { gateId, decision: input.decision, decidedBy: input.decidedBy, decisionComment: input.decisionComment ?? null },
    });
    const continuationRun = this.repository.createRun(gate.missionId, {
      status: "RUNNING",
      inputJson: { continuationOfRunId: gate.runId, reviewGateId: gateId, decision: input.decision },
    });
    const event = this.eventStore.append({
      runId: continuationRun.id,
      eventType: "run.continuation_started",
      eventPhase: "started",
      payloadJson: { missionId: gate.missionId, reviewGateId: gateId, previousRunId: gate.runId },
    });
    return { gate: updatedGate, continuationRun, event };
  }

  createReviewGateForTest(input: Parameters<AgentRepository["createReviewGate"]>[0]): AgentReviewGate {
    return this.repository.createReviewGate(input);
  }
}

export function createFinalAgentEventStoreRuntime() {
  const runtimeConfig = createP0RuntimeConfig();
  const businessRuntime = createBusinessFoundationRuntime();
  const state = new AgentEventStoreState();
  const repository = new AgentRepository(state);
  const eventStore = new InMemoryAgentEventStore(repository, state);
  const toolExecutor = new AgentToolExecutor(repository, eventStore, businessRuntime.agentToolRegistry, new AgentToolPolicy(runtimeConfig));
  const agentService = new FinalAgentService(repository, eventStore, toolExecutor);
  const piAdapter = new MinimalPiAgentLoopAdapter(agentService, eventStore, runtimeConfig);
  return { state, repository, eventStore, toolExecutor, agentService, businessRuntime, piAdapter };
}

function canonicalizeToolName(toolName: string): string {
  const trimmed = toolName.trim();
  if (trimmed === "runSimulation") return "simulateActivityReadiness";
  return trimmed;
}

function toPolicyEvidenceRefs(items: Array<{ entityId: string; label: string; summary: string }>): EvidenceRef[] {
  return items.map((item) => ({ type: "tool_call", entityId: item.entityId, label: item.label, summary: item.summary }));
}

function summarizeToolResult(result: unknown): string {
  if (Array.isArray(result)) return `items=${result.length}`;
  if (result && typeof result === "object") {
    if ("eligibility" in result) return `eligibility=${String((result as { eligibility: unknown }).eligibility)}`;
    if ("isFresh" in result) return `isFresh=${String((result as { isFresh: unknown }).isFresh)}`;
    if ("healthStatus" in result) return `healthStatus=${String((result as { healthStatus: unknown }).healthStatus)}`;
    if ("recommendation" in result) return `recommendation=${String((result as { recommendation: unknown }).recommendation)}`;
  }
  if (result === null || result === undefined) return "empty";
  return typeof result === "string" ? result : "ok";
}
