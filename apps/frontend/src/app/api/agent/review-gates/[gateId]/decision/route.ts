import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'
import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import type { AgentToolCall } from '../../../../../../../../backend/src/domain/entities/AgentToolCall'
import type { AgentRun } from '../../../../../../../../backend/src/domain/entities/AgentRun'
import type { EvidenceLinkDto } from '../../../../../../../../contracts/types/businessFoundation'
import { createLocalPrismaConversationClient } from '../../../chat/local-prisma-client'
import { agentToolRiskLevel, executeFinalApiTool } from '../../../chat/route'

interface RouteContext {
  params: Promise<{ gateId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { gateId } = await context.params
  const payload = (await request.json().catch(() => null)) as { decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; decidedBy?: string; decisionComment?: string } | null
  if (!payload?.decision || !payload.decidedBy) return fail('COMMON.VALIDATION_ERROR', 'decision and decidedBy are required', 400)
  try {
    const repository = createConversationRepository()
    if (repository) {
      try {
        const decision = await repository.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment })
        return ok(await executeApprovedChatReviewGateTool(repository, decision))
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!message.includes('Agent review gate not found')) throw error
      }
    }
    return ok(finalAgentRuntime.agentService.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment }))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent review gate decision failed', 400, { gateId })
  }
}

export async function executeApprovedChatReviewGateTool(
  repository: Pick<PrismaAgentConversationRepository, 'createToolCall' | 'appendRunEvent' | 'markRunStatus'>,
  decision: { gate: { status: string }; continuationRun: AgentRun; approvedToolCall?: AgentToolCall | null },
) {
  if (decision.gate.status !== 'APPROVED' || !decision.approvedToolCall) return decision
  const sourceTool = decision.approvedToolCall
  const execution = await executeFinalApiTool(sourceTool.toolName, sourceTool.inputJson)
  const status = execution.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED'
  const summary = summarizeApprovedToolResult(execution.result, execution.trace.map((item) => item.summary).join('；'))
  const evidenceRefs = execution.evidence.map((item, index) => ({
    id: `${sourceTool.toolName}-approved-evidence-${index}`,
    evidenceType: toConversationEvidenceType(item.type),
    label: item.label,
    summary: item.summary,
    entityId: item.entityId,
  }))
  const toolCall = await repository.createToolCall({
    runId: decision.continuationRun.id,
    externalToolCallId: sourceTool.externalToolCallId,
    toolName: sourceTool.toolName,
    status,
    riskLevel: agentToolRiskLevel(sourceTool.toolName),
    reviewPolicy: 'AUTO_ALLOW',
    inputJson: sourceTool.inputJson,
    outputJson: { ok: status === 'SUCCEEDED', summary, result: execution.result },
    evidenceRefsJson: { refs: evidenceRefs },
    errorMessage: status === 'FAILED' ? summary : null,
  })
  await repository.appendRunEvent({
    runId: decision.continuationRun.id,
    eventType: 'tool.call_recorded',
    eventPhase: status,
    payloadJson: { toolCallId: toolCall.id, toolName: sourceTool.toolName, approvedFromToolCallId: sourceTool.id, outputSummary: summary },
  })
  const completedRun = await repository.markRunStatus({
    runId: decision.continuationRun.id,
    status,
    outputJson: { approvedToolCallId: sourceTool.id, executedToolCallId: toolCall.id, summary },
    errorMessage: status === 'FAILED' ? summary : null,
  })
  return { ...decision, continuationRun: completedRun, executedToolCall: toolCall }
}

function summarizeApprovedToolResult(value: unknown, fallback = '工具已执行') {
  if (typeof value === 'string') return value.slice(0, 240)
  if (!value || typeof value !== 'object') return fallback
  const record = value as Record<string, unknown>
  return String(record.summary ?? record.title ?? record.name ?? record.reportId ?? record.connectorRunId ?? fallback).slice(0, 240)
}

function toConversationEvidenceType(type: EvidenceLinkDto['type']) {
  if (type === 'snapshot') return 'snapshot'
  if (type === 'rule') return 'rule'
  if (type === 'simulation') return 'simulation'
  if (type === 'review') return 'review_gate'
  return 'tool_result'
}

function createConversationRepository() {
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
