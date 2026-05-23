import { fail, finalAgentRuntime, ok } from '../../_final-api-runtime'

import type { AgentEvidenceRef, AgentLinkedEntity, AgentMessage, AgentReviewGate, AgentToolTrace, WorkbenchContext } from '@/modules/agent-copilot/types'
import { businessFoundationSeedFixture } from '../../../../../../contracts/types/businessFoundation.fixture'

interface ChatRequest {
  sessionKey?: string
  message?: string
  context?: WorkbenchContext
}

interface ChatResponse {
  missionId: string
  runId: string
  assistantMessage: AgentMessage
  toolTrace: AgentToolTrace[]
  evidenceRefs: AgentEvidenceRef[]
  linkedEntities: AgentLinkedEntity[]
  reviewGate: AgentReviewGate | null
  fallbackUsed: boolean
}

type ToolExecution = ReturnType<typeof finalAgentRuntime.agentService.executeTool>

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ChatRequest | null
  const message = payload?.message?.trim()
  const sessionKey = payload?.sessionKey?.trim()
  const context = payload?.context

  if (!sessionKey || !message) {
    return fail('COMMON.VALIDATION_ERROR', 'sessionKey and message are required', 400)
  }

  try {
    const mission = finalAgentRuntime.agentService.createMission({
      sessionKey,
      objective: message,
      sourceSurface: 'agent_copilot',
      subjectType: context?.selectedEntity?.entityType ?? null,
      subjectId: context?.selectedEntity?.entityId ?? null,
      workbenchContextJson: context ? serializeContext(context) : undefined,
    })
    const run = finalAgentRuntime.agentService.startRun(mission.mission.id, {
      modelProvider: 'pickagent-chat',
      modelName: 'chat-first-shell',
      inputJson: {
        message,
        context: serializeContext(context),
      },
    })

    finalAgentRuntime.eventStore.append({
      runId: run.id,
      eventType: 'message.user',
      eventPhase: 'received',
      payloadJson: { content: message },
    })

    const executions = executeIntent(run.id, message, context)
    const reply = buildAssistantReply(message, context, executions)
    const toolTrace = executions.map(toToolTrace)
    const evidenceRefs = dedupeById(executions.flatMap((item) => toEvidenceRefs(item)))
    const linkedEntities = dedupeById(buildLinkedEntities(context, executions))
    const reviewGate = executions.find((item) => item.reviewGate)?.reviewGate ?? null

    finalAgentRuntime.eventStore.append({
      runId: run.id,
      eventType: 'assistant.message',
      eventPhase: 'completed',
      payloadJson: {
        content: reply,
        toolNames: toolTrace.map((item) => item.toolName),
        fallbackUsed: false,
      },
    })

    if (!reviewGate) {
      finalAgentRuntime.eventStore.markRunStatus(run.id, 'SUCCEEDED', {
        reply,
        toolNames: toolTrace.map((item) => item.toolName),
      })
    }

    return ok<ChatResponse>({
      missionId: mission.mission.id,
      runId: run.id,
      assistantMessage: {
        id: `assistant-${run.id}`,
        role: 'assistant',
        content: reply,
        status: 'completed',
        linkedEntityIds: linkedEntities.map((item) => item.id),
        evidenceRefIds: evidenceRefs.map((item) => item.id),
      },
      toolTrace,
      evidenceRefs,
      linkedEntities,
      reviewGate: reviewGate ? toReviewGate(reviewGate, run.id) : null,
      fallbackUsed: false,
    })
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent chat request failed', 400)
  }
}

function executeIntent(runId: string, message: string, context?: WorkbenchContext) {
  ensureAgentBusinessSeed()
  const lower = message.toLowerCase()
  const executions: ToolExecution[] = []
  const selectedSkuId = context?.selectedEntity?.entityType === 'sku' ? context.selectedEntity.entityId : null

  if (looksLikeRuleQuestion(lower)) {
    executions.push(
      finalAgentRuntime.agentService.executeTool({
        runId,
        toolName: 'parseActivityRules',
        inputJson: {
          name: `Copilot 规则解读 ${new Date().toISOString()}`,
          platform: inferPlatform(context),
          sourceText: message,
        },
      }),
    )
  }

  if (selectedSkuId && looksLikeSkuQuestion(lower, context)) {
    executions.push(
      finalAgentRuntime.agentService.executeTool({
        runId,
        toolName: 'getSkuSummary',
        inputJson: { skuProfileId: selectedSkuId },
      }),
    )
    executions.push(
      finalAgentRuntime.agentService.executeTool({
        runId,
        toolName: 'diagnoseSkuHealth',
        inputJson: { skuProfileId: selectedSkuId },
      }),
    )
    executions.push(
      finalAgentRuntime.agentService.executeTool({
        runId,
        toolName: 'checkDataFreshness',
        inputJson: { skuProfileId: selectedSkuId },
      }),
    )
    if (looksLikeExplanationQuestion(lower)) {
      executions.push(
        finalAgentRuntime.agentService.executeTool({
          runId,
          toolName: 'explainDecisionWithEvidence',
          inputJson: {
            skuProfileId: selectedSkuId,
            question: message,
          },
        }),
      )
    }
  }

  return executions
}

function buildAssistantReply(message: string, context: WorkbenchContext | undefined, executions: ToolExecution[]) {
  if (executions.length === 0) {
    const selectedLabel = context?.selectedEntity?.label
    return [
      '我已收到你的问题，但这条消息还没有命中明确的业务工具。',
      selectedLabel ? `当前工作台对象是“${selectedLabel}”。` : '当前没有绑定具体业务对象。',
      '你可以直接粘贴活动规则，或在 SKU 页面让我分析当前 SKU 的健康、证据和准入风险。',
    ].join('\n')
  }

  const lines: string[] = []
  const parseExecution = executions.find((item) => item.toolCall.toolName === 'parseActivityRules')
  const summaryExecution = executions.find((item) => item.toolCall.toolName === 'getSkuSummary')
  const diagnosisExecution = executions.find((item) => item.toolCall.toolName === 'diagnoseSkuHealth')
  const freshnessExecution = executions.find((item) => item.toolCall.toolName === 'checkDataFreshness')
  const explanationExecution = executions.find((item) => item.toolCall.toolName === 'explainDecisionWithEvidence')

  if (parseExecution) {
    const result = ((parseExecution.toolCall.outputJson.result ?? {}) as Record<string, unknown>)
    const parseStatus = String(result.parseStatus ?? 'UNKNOWN')
    const ruleCount = Array.isArray(result.rules) ? result.rules.length : 0
    lines.push(`我已先按活动规则来理解你的问题。当前 parse 状态是 ${parseStatus}，识别出 ${ruleCount} 条规则。`)
    if (parseStatus === 'NEEDS_REVIEW') {
      lines.push('这说明规则文本里仍有需要人工确认或补上下文的部分，但已经可以作为后续模拟和核对的输入。')
    }
  }

  if (summaryExecution) {
    const result = ((summaryExecution.toolCall.outputJson.result ?? {}) as Record<string, unknown>)
    lines.push(
      `我已读取当前 SKU 详情：${String(result.productName ?? context?.selectedEntity?.label ?? '当前 SKU')}，平台 ${String(result.platform ?? 'unknown')}，当前健康状态 ${String(result.healthStatus ?? 'unknown')}。`,
    )
  }

  if (diagnosisExecution) {
    const result = ((diagnosisExecution.toolCall.outputJson.result ?? {}) as Record<string, unknown>)
    const issueCount = Array.isArray(result.issues) ? result.issues.length : 0
    lines.push(`最新诊断返回 ${issueCount} 条重点问题，当前判断为 ${String(result.healthStatus ?? 'unknown')}。`)
  }

  if (freshnessExecution) {
    const result = ((freshnessExecution.toolCall.outputJson.result ?? {}) as Record<string, unknown>)
    lines.push(`数据新鲜度检查结果：isFresh=${String(result.isFresh ?? 'unknown')}。`)
  }

  if (explanationExecution) {
    const result = ((explanationExecution.toolCall.outputJson.result ?? {}) as Record<string, unknown>)
    const recommendation = String(result.recommendation ?? '')
    if (recommendation) lines.push(`结合现有 evidence，我的建议是：${recommendation}`)
  }

  if (!lines.length) {
    lines.push(`我已收到你的消息：“${message}”，并执行了 ${executions.length} 个低风险工具。`)
  }

  lines.push('如需继续，我可以基于当前上下文进一步解读规则、解释证据，或继续分析当前 SKU。')
  return lines.join('\n')
}

function toToolTrace(execution: ToolExecution): AgentToolTrace {
  return {
    id: execution.toolCall.id,
    toolName: execution.toolCall.toolName,
    status:
      execution.toolCall.status === 'SUCCEEDED'
        ? 'succeeded'
        : execution.toolCall.status === 'REVIEW_REQUIRED'
          ? 'waiting_for_approval'
          : 'failed',
    riskLevel: execution.riskLevel === 'L3' ? 'L2' : execution.riskLevel,
    reviewPolicy: execution.reviewPolicy === 'REVIEW_GATE' ? 'review_gate' : 'none',
    inputSummary: stringifySummary(execution.toolCall.inputJson),
    outputSummary: stringifySummary(execution.toolCall.outputJson),
    evidenceRefs: execution.evidenceRefs.map((item) => evidenceId(execution.toolCall.id, item.entityId, item.label)),
  }
}

function toEvidenceRefs(execution: ToolExecution): AgentEvidenceRef[] {
  return execution.evidenceRefs.map((item) => ({
    id: evidenceId(execution.toolCall.id, item.entityId, item.label),
    evidenceType: mapEvidenceType(item.type),
    label: item.label,
    summary: item.summary,
    entityId: item.entityId,
  }))
}

function buildLinkedEntities(context: WorkbenchContext | undefined, executions: ToolExecution[]): AgentLinkedEntity[] {
  const current = context?.selectedEntity
    ? [
        {
          id: `entity-context-${context.selectedEntity.entityId}`,
          entityType: mapWorkbenchEntity(context.selectedEntity.entityType),
          entityId: context.selectedEntity.entityId,
          label: context.selectedEntity.label,
          reason: '来自当前 WorkbenchContext 的选中对象。',
          sourceType: 'message' as const,
          sourceId: context.selectedEntity.entityId,
        },
      ]
    : []

  const toolEntities = executions.flatMap((item) =>
    item.evidenceRefs.map((evidence) => ({
      id: `entity-${evidence.entityId}`,
      entityType: inferLinkedEntityType(item.toolCall.toolName),
      entityId: evidence.entityId,
      label: evidence.label,
      reason: evidence.summary,
      sourceType: 'tool_call' as const,
      sourceId: item.toolCall.id,
    })),
  )

  return [...current, ...toolEntities]
}

function toReviewGate(gate: NonNullable<ToolExecution['reviewGate']>, runId: string): AgentReviewGate {
  const status: AgentReviewGate['status'] =
    gate.status === 'CHANGES_REQUESTED'
      ? 'MODIFIED'
      : gate.status === 'APPROVED' || gate.status === 'REJECTED' || gate.status === 'PENDING' || gate.status === 'CANCELED'
        ? gate.status
        : 'PENDING'
  return {
    id: gate.id,
    status,
    reasonCode: gate.reasonCode ?? 'review_gate',
    question: gate.question ?? '需要人工确认下一步动作',
    agentRecommendation: gate.agentRecommendation ?? '请先人工确认后再继续。',
    riskIfApproved: gate.riskIfApproved ?? '会继续执行后续动作。',
    riskIfRejected: gate.riskIfRejected ?? '当前 run 将停留在建议态。',
    evidenceRefs: [],
    reviewItemId: gate.reviewItemId ?? undefined,
    runTraceHref: `/workflows?runId=${runId}`,
  }
}

function serializeContext(context?: WorkbenchContext) {
  return context
    ? {
        route: context.route,
        pageTitle: context.pageTitle,
        selectedEntity: context.selectedEntity,
        visibleFilters: context.visibleFilters,
        visibleColumns: context.visibleColumns ?? [],
      }
    : undefined
}

function looksLikeRuleQuestion(message: string) {
  return ['活动', '规则', '报名', '准入', '门槛', '库存不得', '好评率', '证书'].some((keyword) => message.includes(keyword))
}

function looksLikeSkuQuestion(message: string, context?: WorkbenchContext) {
  if (context?.selectedEntity?.entityType === 'sku') return true
  return ['sku', '商品', '健康', '诊断', '库存', '证书', '详情', '历史'].some((keyword) => message.includes(keyword))
}

function looksLikeExplanationQuestion(message: string) {
  return ['为什么', '原因', '解释', '建议', '风险', 'evidence'].some((keyword) => message.includes(keyword))
}

function inferPlatform(context?: WorkbenchContext) {
  return context?.route.includes('activities') ? 'tmall' : undefined
}

function inferLinkedEntityType(toolName: string): AgentLinkedEntity['entityType'] {
  if (toolName === 'parseActivityRules') return 'activity_rule_set'
  if (toolName === 'simulateActivityReadiness') return 'simulation_run'
  if (toolName === 'getSkuSummary' || toolName === 'diagnoseSkuHealth' || toolName === 'checkDataFreshness') return 'sku_profile'
  return 'workflow_run'
}

function mapWorkbenchEntity(entityType: NonNullable<WorkbenchContext['selectedEntity']>['entityType']): AgentLinkedEntity['entityType'] {
  if (entityType === 'sku') return 'sku_profile'
  if (entityType === 'activityRuleSet') return 'activity_rule_set'
  if (entityType === 'simulationRun') return 'simulation_run'
  if (entityType === 'reviewItem') return 'review_item'
  return 'workflow_run'
}

function mapEvidenceType(type: string): AgentEvidenceRef['evidenceType'] {
  if (type === 'review_gate') return 'review_gate'
  if (type === 'tool_call' || type === 'agent_event' || type === 'policy' || type === 'workflow_step') return 'tool_result'
  return 'tool_result'
}

function evidenceId(toolCallId: string, entityId: string, label: string) {
  return `${toolCallId}:${entityId}:${label}`
}

function stringifySummary(value: unknown) {
  if (!value || typeof value !== 'object') return String(value ?? 'empty')
  return JSON.stringify(value)
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function ensureAgentBusinessSeed() {
  if (finalAgentRuntime.businessRuntime.store.projections.size > 0) return
  finalAgentRuntime.businessRuntime.ingestService.ingest(businessFoundationSeedFixture)
}
