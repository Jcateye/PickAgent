import { fail, ok } from '../../_final-api-runtime'

import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { createBusinessFoundationRuntime } from '../../../../../../backend/src/application/foundation/BusinessFoundationServices'
import { REAL_AGENT_CHAT_NOT_CONFIGURED, RealAgentChatConfigurationError, RealAgentChatRuntime, type AgentConversationEvidenceRef, type AgentConversationLinkedEntity, type AgentConversationRepository, type AgentConversationToolExecution } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import { businessFoundationSeedFixture } from '../../../../../../contracts/types/businessFoundation.fixture'
import { createLocalPrismaConversationClient } from './local-prisma-client'
import { createVercelAiSdkAgentModelAdapterFromEnv } from './vercel-ai-sdk-agent-model-adapter'

import type { AgentEvidenceRef, AgentLinkedEntity, AgentMessage, AgentReviewGate, AgentToolTrace, WorkbenchContext } from '@/modules/agent-copilot/types'

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
  events: unknown[]
  fallbackUsed: false
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ChatRequest | null
  const message = payload?.message?.trim()
  const sessionKey = payload?.sessionKey?.trim()

  if (!sessionKey || !message) {
    return fail('COMMON.VALIDATION_ERROR', 'sessionKey and message are required', 400)
  }

  try {
    const realAgentChatRuntime = createRealAgentChatRuntime()
    const result = await realAgentChatRuntime.sendMessage({
      sessionKey,
      message,
      context: payload?.context,
    })

    return ok<ChatResponse>({
      missionId: result.mission.id,
      runId: result.run.id,
      assistantMessage: {
        id: result.assistantMessage.id,
        role: 'assistant',
        content: result.assistantMessage.contentText ?? '',
        status: result.assistantMessage.status === 'completed' ? 'completed' : 'streaming',
        linkedEntityIds: [],
        evidenceRefIds: [],
      },
      toolTrace: result.toolExecutions.map(toToolTrace),
      evidenceRefs: result.toolExecutions.flatMap((execution) => execution.evidenceRefs.map(toEvidenceRef)),
      linkedEntities: result.toolExecutions.flatMap((execution) => execution.linkedEntities.map(toLinkedEntity)),
      reviewGate: result.toolExecutions.find((execution) => execution.reviewGate)?.reviewGate ? toReviewGate(result.toolExecutions.find((execution) => execution.reviewGate)!.reviewGate!) : null,
      events: result.events,
      fallbackUsed: false,
    })
  } catch (error) {
    if (error instanceof RealAgentChatConfigurationError) {
      return fail(
        REAL_AGENT_CHAT_NOT_CONFIGURED,
        'Real Agent chat requires persistent conversation storage and a model adapter before it can answer.',
        503,
        { missing: error.missing },
      )
    }
    return fail(
      'COMMON.VALIDATION_ERROR',
      'Agent chat request failed before a completed assistant reply. Check persistence and model provider configuration.',
      502,
      { errorType: error instanceof Error ? error.name : 'UnknownError' },
    )
  }
}

function createRealAgentChatRuntime() {
  const repository = createConversationRepository()
  return new RealAgentChatRuntime({
    repository,
    modelAdapter: createVercelAiSdkAgentModelAdapterFromEnv(),
    toolExecutor: repository ? createPersistentToolExecutor(repository) : undefined,
  })
}

function createConversationRepository(): AgentConversationRepository | undefined {
  const local = createLocalPrismaConversationClient()
  if (local.client) return new PrismaAgentConversationRepository(local.client)

  try {
    const requireFromNode = eval('require') as (id: string) => { PrismaClient: new () => unknown }
    const { PrismaClient } = requireFromNode('@prisma/client')
    const prisma = new PrismaClient()
    assertAgentConversationPrismaClient(prisma)
    return new PrismaAgentConversationRepository(prisma)
  } catch {
    return undefined
  }
}

const toolRuntime = createSeededToolRuntime()
const readOnlyTools = new Set(['getSkuSummary', 'checkDataFreshness', 'diagnoseSkuHealth', 'simulateActivityReadiness', 'explainDecisionWithEvidence', 'generateReportPreview'])
const sensitiveKeyPattern = /cookie|token|jwt|sso|secret|api[_-]?key|authorization|password|credential/i

function createPersistentToolExecutor(repository: AgentConversationRepository) {
  return async (input: {
    run: { id: string }
    mission: { id: string }
    toolName: string
    inputJson: Record<string, unknown>
    externalToolCallId?: string | null
  }): Promise<AgentConversationToolExecution> => {
    const toolName = input.toolName === 'reportPreview' ? 'generateReportPreview' : input.toolName
    const safeInput = scrubSensitive(input.inputJson) as Record<string, unknown>
    if (!readOnlyTools.has(toolName) || containsSensitive(input.inputJson)) {
      const reason = containsSensitive(input.inputJson) ? 'sensitive_input_denied' : 'unregistered_tool_denied'
      const toolCall = await repository.createToolCall({
        runId: input.run.id,
        externalToolCallId: input.externalToolCallId ?? null,
        toolName,
        status: 'BLOCKED_BY_POLICY',
        riskLevel: 'L3',
        reviewPolicy: 'DENY',
        inputJson: safeInput,
        outputJson: {},
        evidenceRefsJson: { refs: [] },
        blockedReason: reason,
      })
      await repository.appendRunEvent({
        runId: input.run.id,
        eventType: 'tool.call_recorded',
        eventPhase: 'BLOCKED_BY_POLICY',
        payloadJson: { toolCallId: toolCall.id, toolName, reason },
      })
      return { toolCall, status: 'BLOCKED_BY_POLICY', summary: reason, data: null, evidenceRefs: [], linkedEntities: [], reviewGate: null }
    }

    const execution = toolRuntime.agentToolRegistry.execute(toolName as never, safeInput)
    const status = execution.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED'
    const evidenceRefs = execution.evidence.map((item, index) => toConversationEvidence(toolName, item, index))
    const linkedEntities = execution.linkedEntity ? [toConversationLinkedEntity(toolName, execution.linkedEntity)] : []
    const summary = summarizeToolOutput(execution.result, execution.trace.map((item) => item.summary).join('；'))
    const toolCall = await repository.createToolCall({
      runId: input.run.id,
      externalToolCallId: input.externalToolCallId ?? null,
      toolName,
      status,
      riskLevel: 'L1',
      reviewPolicy: 'AUTO_ALLOW',
      inputJson: safeInput,
      outputJson: scrubSensitive({ ok: status === 'SUCCEEDED', summary, result: execution.result }) as Record<string, unknown>,
      evidenceRefsJson: { refs: evidenceRefs },
      errorMessage: status === 'FAILED' ? summary : null,
    })
    await repository.appendRunEvent({
      runId: input.run.id,
      eventType: 'tool.call_recorded',
      eventPhase: status,
      payloadJson: {
        toolCallId: toolCall.id,
        toolName,
        outputSummary: summary,
        evidenceRefs,
        linkedEntities,
      },
    })
    return { toolCall, status, summary, data: execution.result ?? null, evidenceRefs, linkedEntities, reviewGate: null }
  }
}

function createSeededToolRuntime() {
  const runtime = createBusinessFoundationRuntime()
  runtime.ingestService.ingest(businessFoundationSeedFixture)
  return runtime
}

function toToolTrace(execution: AgentConversationToolExecution): AgentToolTrace {
  return {
    id: execution.toolCall.id,
    toolName: execution.toolCall.toolName,
    status: execution.status === 'SUCCEEDED' ? 'succeeded' : execution.status === 'WAITING_FOR_APPROVAL' ? 'waiting_for_approval' : execution.status === 'BLOCKED_BY_POLICY' ? 'failed' : 'failed',
    riskLevel: execution.toolCall.riskLevel === 'L2' ? 'L2' : execution.toolCall.riskLevel === 'L0' ? 'L0' : 'L1',
    reviewPolicy: execution.toolCall.reviewPolicy === 'REVIEW_GATE' ? 'review_gate' : 'none',
    inputSummary: summarizeToolOutput(execution.toolCall.inputJson),
    outputSummary: execution.summary,
    evidenceRefs: execution.evidenceRefs.map((ref) => ref.id),
  }
}

function toEvidenceRef(ref: AgentConversationEvidenceRef): AgentEvidenceRef {
  return {
    id: ref.id,
    evidenceType: ref.evidenceType,
    label: ref.label,
    summary: ref.summary,
    entityType: ref.entityType as AgentEvidenceRef['entityType'],
    entityId: ref.entityId,
  }
}

function toLinkedEntity(entity: AgentConversationLinkedEntity): AgentLinkedEntity {
  return {
    id: entity.id,
    entityType: entity.entityType as AgentLinkedEntity['entityType'],
    entityId: entity.entityId,
    label: entity.label,
    reason: entity.reason,
    sourceType: entity.sourceType,
    sourceId: entity.sourceId,
  }
}

function toReviewGate(gate: { id: string; status: string; reasonCode: string; question: string; agentRecommendation: string | null; riskIfApproved: string | null; riskIfRejected: string | null; evidenceRefsJson: Record<string, unknown>; reviewItemId: string | null }): AgentReviewGate {
  return {
    id: gate.id,
    status: gate.status as AgentReviewGate['status'],
    reasonCode: gate.reasonCode,
    question: gate.question,
    agentRecommendation: gate.agentRecommendation ?? '',
    riskIfApproved: gate.riskIfApproved ?? '',
    riskIfRejected: gate.riskIfRejected ?? '',
    evidenceRefs: Array.isArray(gate.evidenceRefsJson.refs) ? gate.evidenceRefsJson.refs.map((item) => String((item as { id?: unknown }).id ?? '')) : [],
    reviewItemId: gate.reviewItemId ?? undefined,
  }
}

function toConversationEvidence(toolName: string, item: { type: string; entityId: string; label: string; summary: string }, index: number): AgentConversationEvidenceRef {
  return {
    id: `${toolName}-evidence-${item.entityId || index}`,
    evidenceType: item.type === 'simulation' ? 'simulation' : item.type === 'rule' ? 'rule' : item.type === 'review_gate' ? 'review_gate' : item.type === 'snapshot' ? 'snapshot' : 'tool_result',
    label: item.label,
    summary: item.summary,
    entityType: item.type === 'simulation' ? 'simulation_run' : item.type === 'snapshot' ? 'sku_profile' : undefined,
    entityId: item.entityId,
  }
}

function toConversationLinkedEntity(toolName: string, entity: { type: string; id: string }): AgentConversationLinkedEntity {
  return {
    id: `${toolName}-entity-${entity.id}`,
    entityType: entity.type === 'report' ? 'workflow_run' : entity.type,
    entityId: entity.id,
    label: entity.type,
    reason: `由 ${toolName} 工具返回`,
    sourceType: 'tool_call',
    sourceId: toolName,
  }
}

function summarizeToolOutput(value: unknown, fallback = '工具已执行'): string {
  if (typeof value === 'string') return value.slice(0, 240)
  if (!value || typeof value !== 'object') return fallback
  if ('productName' in value) return `SKU ${String((value as { productName?: unknown }).productName)} 摘要已读取`
  if ('healthStatus' in value) return `健康状态：${String((value as { healthStatus?: unknown }).healthStatus)}`
  if ('freshnessStatus' in value) return `数据新鲜度：${String((value as { freshnessStatus?: unknown }).freshnessStatus)}`
  if ('title' in value) return String((value as { title?: unknown }).title)
  return JSON.stringify(value).slice(0, 240)
}

function containsSensitive(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitive)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) => sensitiveKeyPattern.test(key) || containsSensitive(child))
}

function scrubSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSensitive)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sensitiveKeyPattern.test(key) ? '[REDACTED]' : scrubSensitive(child)]))
}
