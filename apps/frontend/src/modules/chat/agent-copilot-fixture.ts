import type { AgentMissionRun } from './agent-copilot-contract'

const basePlan = [
  {
    id: 'plan-1',
    title: '锁定 Mission 与工作台上下文',
    detail: '读取当前活动规则、SKU 投影和近期采集快照，只形成上下文，不改写业务数据。',
    status: 'completed',
    toolName: 'workbench_context.snapshot',
  },
  {
    id: 'plan-2',
    title: '调用已注册业务工具做准入复核',
    detail: '通过 AgentToolRegistry 调用模拟预览工具，生成 trace、linked entity 和 evidence 摘要。',
    status: 'completed',
    toolName: 'activity.simulation.preview',
  },
  {
    id: 'plan-3',
    title: '在 Review Gate 暂停',
    detail: '发现价格字段与活动价存在冲突，L2 风险必须等待人工决策。',
    status: 'waiting_for_review',
    toolName: 'review_gate.open',
  },
  {
    id: 'plan-4',
    title: '按 Gate 决策继续执行',
    detail: '人工确认后追加后续消息，保留同一 Mission 语义和 run 事件 contract。',
    status: 'pending',
  },
] satisfies AgentMissionRun['plan']

export function createFakeAgentMissionRun(objective: string): AgentMissionRun {
  return {
    mission: {
      id: 'mission-demo-001',
      objective,
      status: 'WAITING_FOR_REVIEW',
      autonomyLevel: 'L2_REVIEW_GATED_AGENT',
      sourceSurface: 'agent_copilot',
    },
    run: {
      id: 'run-demo-001',
      status: 'PAUSED',
      provider: 'fake',
      progressPercent: 72,
    },
    eventContractVersion: 'agent-run-events.v1',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: objective,
        status: 'completed',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: '我已按 Mission 创建 fake run，并读取当前活动、SKU 投影和 Review 入口。当前没有直接写业务数据。',
        status: 'completed',
        linkedEntityIds: ['entity-activity', 'entity-sku'],
        evidenceRefIds: ['evidence-snapshot'],
      },
      {
        id: 'msg-3',
        role: 'tool',
        content: 'activity.simulation.preview 返回：SKU-A17 可修复进入活动，但活动价低于近 30 天最低价阈值，需要 Review Gate。',
        status: 'completed',
        linkedEntityIds: ['entity-simulation'],
        evidenceRefIds: ['evidence-rule', 'evidence-tool'],
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: '我已暂停 run。请先确认是否允许按建议活动价继续生成 Review 项，或拒绝并保持当前活动模拟结果。',
        status: 'completed',
        linkedEntityIds: ['entity-review'],
        evidenceRefIds: ['evidence-gate'],
      },
    ],
    plan: basePlan,
    toolTrace: [
      {
        id: 'tool-1',
        toolName: 'workbench_context.snapshot',
        status: 'succeeded',
        riskLevel: 'L0',
        reviewPolicy: 'none',
        inputSummary: 'surface=agent_copilot, subject=activity_rule_set:summer-promo',
        outputSummary: '绑定 1 个活动规则、1 个 SKU 投影、1 个最新采集快照。',
        evidenceRefs: ['evidence-snapshot'],
      },
      {
        id: 'tool-2',
        toolName: 'activity.simulation.preview',
        status: 'succeeded',
        riskLevel: 'L1',
        reviewPolicy: 'none',
        inputSummary: 'skuProfileId=SKU-A17, ruleSetId=summer-promo',
        outputSummary: '准入状态为 REPAIRABLE_READY，修复动作需要人工确认。',
        evidenceRefs: ['evidence-rule', 'evidence-tool'],
      },
      {
        id: 'tool-3',
        toolName: 'review_gate.open',
        status: 'waiting_for_approval',
        riskLevel: 'L2',
        reviewPolicy: 'review_gate',
        inputSummary: 'reason=PRICE_CONFLICT, toolCallId=tool-2',
        outputSummary: 'run 已暂停，等待 approve / reject / modify。',
        evidenceRefs: ['evidence-gate'],
      },
    ],
    linkedEntities: [
      {
        id: 'entity-activity',
        entityType: 'activity_rule_set',
        entityId: 'summer-promo',
        label: 'Summer Promo 活动规则',
        reason: 'Mission 的准入判断对象。',
        sourceType: 'mission',
        sourceId: 'mission-demo-001',
      },
      {
        id: 'entity-sku',
        entityType: 'sku_profile',
        entityId: 'SKU-A17',
        label: 'SKU-A17 冷萃杯',
        reason: '当前活动模拟命中的 SKU 档案。',
        sourceType: 'tool_call',
        sourceId: 'tool-1',
      },
      {
        id: 'entity-simulation',
        entityType: 'simulation_run',
        entityId: 'sim-preview-018',
        label: '准入模拟预览 #018',
        reason: '用于解释 REPAIRABLE_READY 结论。',
        sourceType: 'tool_call',
        sourceId: 'tool-2',
      },
      {
        id: 'entity-review',
        entityType: 'review_item',
        entityId: 'review-price-conflict',
        label: '价格冲突 Review Gate',
        reason: 'L2 风险必须人工确认。',
        sourceType: 'review_gate',
        sourceId: 'gate-1',
      },
    ],
    evidenceRefs: [
      {
        id: 'evidence-snapshot',
        evidenceType: 'snapshot',
        label: '最新采集快照',
        summary: '库存、近 30 天价格、活动价字段来自同一次 mock context snapshot。',
        entityType: 'sku_profile',
        entityId: 'SKU-A17',
      },
      {
        id: 'evidence-rule',
        evidenceType: 'rule',
        label: '活动价阈值规则',
        summary: '活动价不得低于近 30 天最低价，低置信或冲突进入 Review。',
        entityType: 'activity_rule_set',
        entityId: 'summer-promo',
      },
      {
        id: 'evidence-tool',
        evidenceType: 'tool_result',
        label: '模拟预览工具结果',
        summary: 'activity.simulation.preview 仅输出预览，不写入最终业务结论。',
        entityType: 'simulation_run',
        entityId: 'sim-preview-018',
      },
      {
        id: 'evidence-gate',
        evidenceType: 'review_gate',
        label: 'Review Gate 暂停点',
        summary: '风险等级 L2，fake runtime 暂停并等待人工决策。',
        entityType: 'review_item',
        entityId: 'review-price-conflict',
      },
    ],
    reviewGates: [
      {
        id: 'gate-1',
        status: 'PENDING',
        reasonCode: 'PRICE_CONFLICT',
        question: '是否允许按建议活动价继续生成 Review 项？',
        agentRecommendation: '建议继续，但仅创建 Review 项与后续执行建议，不直接修改 SKU 或活动业务真相。',
        riskIfApproved: '会进入后续 Review 流程，需要人工在员工工作台做最终审批。',
        riskIfRejected: '当前活动模拟保持可修复状态，但本次 Mission 不再推进价格修复建议。',
        evidenceRefs: ['evidence-rule', 'evidence-tool', 'evidence-gate'],
      },
    ],
    nextActions: ['批准继续并生成后续建议', '拒绝本次推进', '修改约束后继续同一 Mission'],
  }
}

export function continueFakeAgentMissionRun(run: AgentMissionRun, decision: 'approve' | 'reject' | 'modify'): AgentMissionRun {
  const gateStatus = decision === 'approve' ? 'APPROVED' : decision === 'reject' ? 'REJECTED' : 'MODIFIED'
  const decisionText = {
    approve: '已批准继续。fake run 将生成 Review 项草案，并保持业务最终审批在 Review 工作台。',
    reject: '已拒绝继续。fake run 记录拒绝原因，Mission 以不推进修复建议结束。',
    modify: '已选择修改。fake run 保留 Mission，并等待新的约束输入后继续。',
  }[decision]

  return {
    ...run,
    mission: {
      ...run.mission,
      status: decision === 'modify' ? 'WAITING_FOR_DATA' : 'COMPLETED',
    },
    run: {
      ...run.run,
      status: decision === 'modify' ? 'PAUSED' : 'DONE',
      progressPercent: decision === 'modify' ? 82 : 100,
    },
    messages: [
      ...run.messages,
      {
        id: `msg-decision-${decision}`,
        role: 'user',
        content: `Gate 决策：${decision}`,
        status: 'completed',
      },
      {
        id: `msg-resume-${decision}`,
        role: 'assistant',
        content: decisionText,
        status: 'completed',
        linkedEntityIds: ['entity-review'],
        evidenceRefIds: ['evidence-gate'],
      },
    ],
    plan: run.plan.map((step) => {
      if (step.id === 'plan-3') return { ...step, status: 'completed' }
      if (step.id === 'plan-4') return { ...step, status: decision === 'modify' ? 'waiting_for_data' : 'completed' }
      return step
    }),
    toolTrace: run.toolTrace.map((tool) => {
      if (tool.id !== 'tool-3') return tool
      return {
        ...tool,
        status: decision === 'modify' ? 'waiting_for_approval' : 'succeeded',
        outputSummary: `Gate decision=${decision}; provider=fake; contract=agent-run-events.v1`,
      }
    }),
    reviewGates: run.reviewGates.map((gate) => ({
      ...gate,
      status: gateStatus,
      decision,
      decisionComment: decisionText,
    })),
    nextActions:
      decision === 'modify'
        ? ['补充新的价格约束后继续 Mission', '查看 linked evidence', '取消本次 Mission']
        : ['查看 Review 工作台入口', '打开 run 事件回放', '基于同一 Mission 追加追问'],
  }
}
