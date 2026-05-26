import type {
  AgentEvidenceRef,
  AgentLinkedEntity,
  AgentMissionRun,
  AgentPlanStep,
  AgentReviewGate,
  AgentToolTrace,
} from "../../../../contracts/types/agent-copilot-workbench";
import type { AgentToolExecutionDto, AgentToolName, EvidenceLinkDto } from "../../../../contracts/types/businessFoundation";
import type { AgentToolRegistry } from "../foundation/BusinessFoundationServices";

export interface AgentMissionStartInput {
  objective: string;
  skuProfileId?: string;
}

export interface AgentMissionContinueInput {
  decision: "approve" | "reject" | "modify";
  comment?: string;
}

export interface AgentLoopAdapter {
  readonly provider: AgentMissionRun["run"]["provider"];
  readonly contractVersion: AgentMissionRun["eventContractVersion"];
  readonly availableTools: readonly AgentToolName[];
  readonly disabledRuntimeTools: readonly string[];
  startMission(input: AgentMissionStartInput): AgentMissionRun;
  continueMission(run: AgentMissionRun, input: AgentMissionContinueInput): AgentMissionRun;
}

const registeredBusinessTools = [
  "getSkuSummary",
  "parseActivityRules",
  "simulateActivityReadiness",
  "runSimulation",
  "checkDataFreshness",
  "diagnoseSkuHealth",
  "createReviewItems",
  "explainDecisionWithEvidence",
  "generateReportPreview",
] as const satisfies readonly AgentToolName[];

const disabledRuntimeTools = ["coding", "file", "bash"] as const;

export class LocalBusinessAgentLoopAdapter implements AgentLoopAdapter {
  readonly provider = "local";
  readonly contractVersion = "agent-run-events.v1";
  readonly availableTools = registeredBusinessTools;
  readonly disabledRuntimeTools = disabledRuntimeTools;

  constructor(private readonly agentToolRegistry: AgentToolRegistry) {}

  startMission(input: AgentMissionStartInput): AgentMissionRun {
    const missionId = "mission-runtime-demo-001";
    const runId = "run-runtime-demo-001";
    const objective = input.objective.trim() || "复核当前 SKU 活动准入风险";
    const skuProfileId = input.skuProfileId;
    const toolExecution = skuProfileId ? this.agentToolRegistry.execute("getSkuSummary", { skuProfileId }) : null;
    const toolSucceeded = toolExecution?.status === "SUCCEEDED";
    const evidenceRefs = toolExecution ? toEvidenceRefs(toolExecution.evidence) : [];
    const linkedEntities = toolExecution ? toLinkedEntities(missionId, toolExecution, skuProfileId) : [];
    const reviewGate = createRuntimeReviewGate(evidenceRefs.map((item) => item.id));

    return {
      mission: {
        id: missionId,
        objective,
        status: "WAITING_FOR_REVIEW",
        autonomyLevel: "L2_REVIEW_GATED_AGENT",
        sourceSurface: "agent_copilot",
      },
      run: {
        id: runId,
        status: "PAUSED",
        provider: this.provider,
        progressPercent: toolSucceeded ? 76 : 48,
      },
      eventContractVersion: this.contractVersion,
      messages: [
        {
          id: "msg-runtime-user-1",
          role: "user",
          content: objective,
          status: "completed",
        },
        {
          id: "msg-runtime-agent-1",
          role: "assistant",
          content: "已启动本地业务 Agent 运行适配器，并只暴露 AgentToolRegistry 中的可审计业务工具。",
          status: "completed",
          linkedEntityIds: linkedEntities.map((item) => item.id),
          evidenceRefIds: evidenceRefs.map((item) => item.id),
        },
        {
          id: "msg-runtime-tool-1",
          role: "tool",
          content: toolExecution
            ? `getSkuSummary ${toolExecution.status}: ${toolExecution.trace.map((item) => item.summary).join("；")}`
            : "未提供 skuProfileId，本次只验证 runtime/tool boundary，不执行业务查询。",
          status: "completed",
          linkedEntityIds: linkedEntities.map((item) => item.id),
          evidenceRefIds: evidenceRefs.map((item) => item.id),
        },
        {
          id: "msg-runtime-agent-2",
          role: "assistant",
          content: "run 已在 Review Gate 暂停。本地业务适配器不开放 coding、file 或 bash 工具。",
          status: "completed",
          evidenceRefIds: [reviewGate.evidenceRefs[0]].filter((item): item is string => Boolean(item)),
        },
      ],
      plan: createPlan(Boolean(toolExecution), toolSucceeded),
      toolTrace: [
        {
          id: "tool-runtime-boundary",
          toolName: "runtime.boundary",
          status: "succeeded",
          riskLevel: "L0",
          reviewPolicy: "none",
          inputSummary: `provider=${this.provider}, disabled=${this.disabledRuntimeTools.join(",")}`,
          outputSummary: `available=${this.availableTools.join(",")}`,
          evidenceRefs: [],
        },
        ...(toolExecution ? [toToolTrace(toolExecution, evidenceRefs)] : []),
        {
          id: "tool-runtime-review-gate",
          toolName: "review_gate.open",
          status: "waiting_for_approval",
          riskLevel: "L2",
          reviewPolicy: "review_gate",
          inputSummary: "reason=RUNTIME_TOOL_BOUNDARY_CONFIRMATION",
          outputSummary: "等待人工确认后继续，不自动执行高风险动作。",
          evidenceRefs: reviewGate.evidenceRefs,
        },
      ],
      linkedEntities,
      evidenceRefs: [...evidenceRefs, createToolBoundaryEvidence()],
      reviewGates: [reviewGate],
      nextActions: ["批准继续同一 Mission", "拒绝本次执行", "修改约束后继续"],
    };
  }

  continueMission(run: AgentMissionRun, input: AgentMissionContinueInput): AgentMissionRun {
    const gateStatus = input.decision === "approve" ? "APPROVED" : input.decision === "reject" ? "REJECTED" : "MODIFIED";
    const completed = input.decision !== "modify";
    const decisionText =
      input.comment ??
      (input.decision === "approve"
        ? "已批准继续，本地业务适配器只记录后续建议，不直接改写业务数据。"
        : input.decision === "reject"
          ? "已拒绝继续，Mission 结束并保留 trace。"
          : "已要求修改，Mission 等待新的约束输入。");

    return {
      ...run,
      mission: {
        ...run.mission,
        status: completed ? "COMPLETED" : "WAITING_FOR_DATA",
      },
      run: {
        ...run.run,
        status: completed ? "DONE" : "PAUSED",
        progressPercent: completed ? 100 : 84,
      },
      messages: [
        ...run.messages,
        {
          id: `msg-runtime-decision-${input.decision}`,
          role: "user",
          content: `Gate 决策：${input.decision}`,
          status: "completed",
        },
        {
          id: `msg-runtime-continue-${input.decision}`,
          role: "assistant",
          content: decisionText,
          status: "completed",
        },
      ],
      plan: run.plan.map((step) =>
        step.id === "plan-runtime-gate"
          ? { ...step, status: "completed" }
          : step.id === "plan-runtime-continue"
            ? { ...step, status: completed ? "completed" : "waiting_for_data" }
            : step,
      ),
      toolTrace: run.toolTrace.map((tool) =>
        tool.id === "tool-runtime-review-gate"
          ? { ...tool, status: completed ? "succeeded" : "waiting_for_approval", outputSummary: `Gate decision=${input.decision}; provider=${this.provider}` }
          : tool,
      ),
      reviewGates: run.reviewGates.map((gate) => ({
        ...gate,
        status: gateStatus,
        decision: input.decision,
        decisionComment: decisionText,
      })),
      nextActions: completed ? ["查看 Review 工作台", "查看 run 事件回放"] : ["补充约束后继续", "取消本次 Mission"],
    };
  }
}

function createPlan(hasToolInput: boolean, toolSucceeded: boolean): AgentPlanStep[] {
  return [
    {
      id: "plan-runtime-boundary",
      title: "确认 runtime 与工具边界",
      detail: "使用本地业务 Agent 运行适配器，业务能力只来自 AgentToolRegistry。",
      status: "completed",
      toolName: "runtime.boundary",
    },
    {
      id: "plan-runtime-tool",
      title: "调用已注册业务工具",
      detail: hasToolInput ? "通过 getSkuSummary 读取 SKU 当前摘要。" : "未提供 SKU，跳过业务查询。",
      status: hasToolInput && toolSucceeded ? "completed" : hasToolInput ? "waiting_for_data" : "completed",
      toolName: "getSkuSummary",
    },
    {
      id: "plan-runtime-gate",
      title: "在 Review Gate 暂停",
      detail: "L2 自治等级下只产生建议与 trace，不静默执行高风险动作。",
      status: "waiting_for_review",
      toolName: "review_gate.open",
    },
    {
      id: "plan-runtime-continue",
      title: "按人工决策继续",
      detail: "Gate 决策后在同一 Mission contract 下继续或结束。",
      status: "pending",
    },
  ];
}

function toToolTrace(toolExecution: AgentToolExecutionDto, evidenceRefs: AgentEvidenceRef[]): AgentToolTrace {
  return {
    id: toolExecution.toolCallId,
    toolName: toolExecution.toolName,
    status: toolExecution.status === "SUCCEEDED" ? "succeeded" : "failed",
    riskLevel: "L1",
    reviewPolicy: "none",
    inputSummary: `tool=${toolExecution.toolName}`,
    outputSummary: toolExecution.trace.map((item) => item.summary).join("；"),
    evidenceRefs: evidenceRefs.map((item) => item.id),
  };
}

function toEvidenceRefs(evidence: EvidenceLinkDto[]): AgentEvidenceRef[] {
  return evidence.map((item, index) => ({
    id: `evidence-runtime-${index + 1}`,
    evidenceType: toAgentEvidenceType(item.type),
    label: item.label,
    summary: item.summary,
    entityId: item.entityId,
  }));
}

function toAgentEvidenceType(type: EvidenceLinkDto["type"]): AgentEvidenceRef["evidenceType"] {
  if (type === "snapshot" || type === "rule" || type === "simulation") return type;
  if (type === "review") return "review_gate";
  return "tool_result";
}

function toLinkedEntities(missionId: string, toolExecution: AgentToolExecutionDto, skuProfileId?: string): AgentLinkedEntity[] {
  const entities: AgentLinkedEntity[] = [];
  if (skuProfileId) {
    entities.push({
      id: "entity-runtime-sku",
      entityType: "sku_profile",
      entityId: skuProfileId,
      label: `SKU ${skuProfileId}`,
      reason: "Mission 指定的业务对象。",
      sourceType: "mission",
      sourceId: missionId,
    });
  }
  if (toolExecution.linkedEntity?.type === "review_item") {
    entities.push({
      id: "entity-runtime-review",
      entityType: "review_item",
      entityId: toolExecution.linkedEntity.id,
      label: "Agent 工具关联 Review 项",
      reason: "业务工具执行结果关联。",
      sourceType: "tool_call",
      sourceId: toolExecution.toolCallId,
    });
  }
  return entities;
}

function createRuntimeReviewGate(evidenceRefs: string[]): AgentReviewGate {
  return {
    id: "gate-runtime-boundary",
    status: "PENDING",
    reasonCode: "RUNTIME_TOOL_BOUNDARY_CONFIRMATION",
    question: "是否允许本地业务 Agent 在同一 Mission 中继续生成后续建议？",
    agentRecommendation: "建议继续，但保持 Review Gate，不连接生产 Pi，不开放 coding/file/bash。",
    riskIfApproved: "只会追加建议、trace 与可审计上下文，不直接修改业务数据。",
    riskIfRejected: "Mission 停止，已生成的工具 trace 和 evidence 保留。",
    evidenceRefs: evidenceRefs.length ? evidenceRefs : ["evidence-runtime-tool-boundary"],
  };
}

function createToolBoundaryEvidence(): AgentEvidenceRef {
  return {
    id: "evidence-runtime-tool-boundary",
    evidenceType: "tool_result",
    label: "AgentToolRegistry 边界",
    summary: "本地业务 Agent 运行适配器只调用注册业务工具，禁用 coding、file、bash。",
  };
}
