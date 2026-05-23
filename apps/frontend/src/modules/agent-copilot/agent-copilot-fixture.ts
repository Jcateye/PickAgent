import type { AgentMissionRun, WorkbenchContext, WorkbenchEntityType } from './types'

const basePlan = [
  {
    id: 'plan-1',
    title: '读取 WorkbenchContext',
    detail: '读取当前 route、selectedEntity、visibleFilters，形成本轮 Agent 可见上下文。',
    status: 'completed',
    toolName: 'workbench_context.snapshot',
  },
  {
    id: 'plan-2',
    title: '消费 EventStore replay',
    detail: '通过 /api/agent/runs/:runId/events?after=sequence 拉取缺失事件，再挂接 SSE contract。',
    status: 'completed',
    toolName: 'agent_event_store.replay',
  },
  {
    id: 'plan-3',
    title: '检查 Review Gate',
    detail: '发现 L2 gate 时暂停在 sidecar，所有继续动作链接 gate、review 与 run trace。',
    status: 'waiting_for_review',
    toolName: 'review_gate.open',
  },
  {
    id: 'plan-4',
    title: '创建 continuation run',
    detail: '批准后展示 continuation run，不直接执行自动改价、报名或商品修改。',
    status: 'pending',
  },
] satisfies AgentMissionRun['plan']

export function createCopilotFixtureRun(context: WorkbenchContext): AgentMissionRun {
  const selectedLabel = context.selectedEntity?.label ?? context.pageTitle
  const selectedEntityId = context.selectedEntity?.entityId ?? context.route
  const selectedEntityType = context.selectedEntity?.entityType ?? 'dashboard'

  return {
    mission: {
      id: 'mission-overlay-demo',
      objective: `基于 ${selectedLabel} 解释当前风险和下一步`,
      status: 'WAITING_FOR_REVIEW',
      autonomyLevel: 'L2_REVIEW_GATED_AGENT',
      sourceSurface: 'agent_copilot',
    },
    run: {
      id: 'agent_run_overlay_demo',
      status: 'PAUSED',
      provider: 'eventstore',
      progressPercent: 74,
    },
    eventContractVersion: 'agent-run-events.v1',
    messages: [
      {
        id: 'msg-context',
        role: 'assistant',
        content: `已读取当前工作台上下文：${context.pageTitle}，对象 ${selectedLabel}，route=${context.route}。`,
        status: 'completed',
        linkedEntityIds: ['entity-current'],
        evidenceRefIds: ['evidence-context'],
      },
      {
        id: 'msg-eventstore',
        role: 'tool',
        content: '已按 EventStore replay contract 拉取 run event，并准备通过 SSE 接收后续增量。',
        status: 'completed',
        evidenceRefIds: ['evidence-eventstore'],
      },
      {
        id: 'msg-gate',
        role: 'assistant',
        content: '当前建议需要人工 Review Gate。批准后只创建 continuation run 和 Review 链接，不执行高风险业务写入。',
        status: 'completed',
        linkedEntityIds: ['entity-gate'],
        evidenceRefIds: ['evidence-gate'],
      },
    ],
    plan: basePlan,
    toolTrace: [
      {
        id: 'tool-context',
        toolName: 'workbench_context.snapshot',
        status: 'succeeded',
        riskLevel: 'L0',
        reviewPolicy: 'none',
        inputSummary: `route=${context.route}; selected=${selectedEntityType}:${selectedEntityId}`,
        outputSummary: `visibleFilters=${JSON.stringify(context.visibleFilters)}`,
        evidenceRefs: ['evidence-context'],
      },
      {
        id: 'tool-replay',
        toolName: 'agent_event_store.replay',
        status: 'succeeded',
        riskLevel: 'L0',
        reviewPolicy: 'none',
        inputSummary: 'GET /api/agent/runs/agent_run_overlay_demo/events?after=0',
        outputSummary: '前端 hook 保存 lastSequence，断线后按 after 继续重放。',
        evidenceRefs: ['evidence-eventstore'],
      },
      {
        id: 'tool-gate',
        toolName: 'review_gate.open',
        status: 'waiting_for_approval',
        riskLevel: 'L2',
        reviewPolicy: 'review_gate',
        inputSummary: 'reason=HUMAN_CONFIRMATION_REQUIRED',
        outputSummary: 'sidecar 显示 gate、review、run trace 三个入口。',
        evidenceRefs: ['evidence-gate'],
      },
    ],
    linkedEntities: [
      {
        id: 'entity-current',
        entityType: mapWorkbenchEntity(selectedEntityType),
        entityId: selectedEntityId,
        label: selectedLabel,
        reason: '当前页面注册的 WorkbenchContext selectedEntity。',
        sourceType: 'mission',
        sourceId: 'mission-overlay-demo',
      },
      {
        id: 'entity-gate',
        entityType: 'review_item',
        entityId: 'review-overlay-gate',
        label: 'Overlay Review Gate',
        reason: 'sidecar 的继续动作必须回链到 Review 与 run trace。',
        sourceType: 'review_gate',
        sourceId: 'agent_gate_overlay_demo',
      },
    ],
    evidenceRefs: [
      {
        id: 'evidence-context',
        evidenceType: 'snapshot',
        label: 'WorkbenchContext Snapshot',
        summary: '包含 route、selectedEntity、visibleFilters 和 visibleColumns。',
        entityType: mapWorkbenchEntity(selectedEntityType),
        entityId: selectedEntityId,
      },
      {
        id: 'evidence-eventstore',
        evidenceType: 'tool_result',
        label: 'EventStore replay / SSE',
        summary: '生产路径消费 /api/agent/runs/:runId/events；无 runId 时仅显示 fixture fallback。',
      },
      {
        id: 'evidence-gate',
        evidenceType: 'review_gate',
        label: 'Review Gate next action',
        summary: 'Gate 批准后展示 continuation run，并链接 Review 工作台和 Workflows run trace。',
        entityType: 'review_item',
        entityId: 'review-overlay-gate',
      },
    ],
    reviewGates: [
      {
        id: 'agent_gate_overlay_demo',
        status: 'PENDING',
        reasonCode: 'HUMAN_CONFIRMATION_REQUIRED',
        question: `是否允许 Copilot 基于 ${selectedLabel} 创建后续 Review 建议？`,
        agentRecommendation: '建议继续生成 Review 建议和 run trace，不执行自动改价、自动报名或商品详情修改。',
        riskIfApproved: '会创建 continuation run，并把后续处理交给 Review 工作台确认。',
        riskIfRejected: '本次 Mission 停止推进，当前页面业务状态不变。',
        evidenceRefs: ['evidence-context', 'evidence-eventstore', 'evidence-gate'],
        reviewItemId: 'review-overlay-gate',
        runTraceHref: '/workflows?runId=agent_run_overlay_demo',
      },
    ],
    nextActions: ['批准并打开 continuation run', '查看 Review item', '查看 run trace'],
  }
}

export function continueCopilotFixtureRun(run: AgentMissionRun, decision: 'approve' | 'reject' | 'modify'): AgentMissionRun {
  const continuationRunId = decision === 'approve' ? 'agent_run_overlay_continuation' : undefined
  return {
    ...run,
    mission: { ...run.mission, status: decision === 'modify' ? 'WAITING_FOR_DATA' : 'COMPLETED' },
    run: {
      ...run.run,
      status: decision === 'modify' ? 'PAUSED' : 'DONE',
      progressPercent: decision === 'modify' ? 84 : 100,
    },
    messages: [
      ...run.messages,
      {
        id: `msg-decision-${decision}`,
        role: 'assistant',
        content:
          decision === 'approve'
            ? 'Gate 已批准：已展示 continuation run 入口，业务最终决策仍在 Review 工作台。'
            : decision === 'modify'
              ? 'Gate 要求修改：等待新的约束输入后继续同一 Mission。'
              : 'Gate 已拒绝：本次 Mission 不再推进，业务数据保持不变。',
        status: 'completed',
        linkedEntityIds: ['entity-gate'],
        evidenceRefIds: ['evidence-gate'],
      },
    ],
    plan: run.plan.map((step) => {
      if (step.id === 'plan-3') return { ...step, status: 'completed' }
      if (step.id === 'plan-4') return { ...step, status: decision === 'modify' ? 'waiting_for_data' : 'completed' }
      return step
    }),
    reviewGates: run.reviewGates.map((gate) => ({
      ...gate,
      status: decision === 'approve' ? 'APPROVED' : decision === 'reject' ? 'REJECTED' : 'MODIFIED',
      decision,
      continuationRunId,
    })),
    nextActions: continuationRunId ? [`Continuation run: ${continuationRunId}`, '查看 Review item', '查看 run trace'] : ['查看 gate 决策记录', '查看 Review item', '查看 run trace'],
  }
}

function mapWorkbenchEntity(entityType: WorkbenchEntityType): AgentMissionRun['linkedEntities'][number]['entityType'] {
  if (entityType === 'activityRuleSet') return 'activity_rule_set'
  if (entityType === 'simulationRun') return 'simulation_run'
  if (entityType === 'reviewItem') return 'review_item'
  if (entityType === 'sku') return 'sku_profile'
  return 'workflow_run'
}
