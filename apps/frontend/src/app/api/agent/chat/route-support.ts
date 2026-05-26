import { fail, finalAgentRuntime, finalApiRuntime, ok } from '../../_final-api-runtime'

import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { REAL_AGENT_CHAT_NOT_CONFIGURED, RealAgentChatConfigurationError, RealAgentChatRuntime, type AgentConversationEvidenceRef, type AgentConversationLinkedEntity, type AgentConversationRepository, type AgentConversationToolExecution } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import type { CreateRuleSetInputDto, UpdateRuleSetInputDto } from '../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import type { BrowserPageDetectionRequestDto, BrowserScanPreviewRequestDto, CreateConnectorDto, CreateConnectorSyncRunDto, UpdateConnectorDto } from '../../../../../../contracts/types/connectorBackend'
import type { CreateActivityRequestDto, UpdateActivityRequestDto } from '../../../../../../contracts/types/activityManagement'
import { defaultAgentToolNames, type CanonicalRuleDto, type EvidenceLinkDto, type IngestPayloadDto, type IngestRowDto, type ReviewItemDto, type RuleSetStatusDto, type SettingsUserDto, type SkuDetailDto, type SkuSummaryDto, type ToolPolicyDto, type WorkspaceSettingsDto } from '../../../../../../contracts/types/businessFoundation'
import type { ReportExportRequestDto, ReportSubscriptionRequestDto, ReviewDecisionRequestDto, ReviewListQueryDto } from '../../../../../../contracts/types/reviewReportCenter'
import type { DashboardSkuListItemDto, DashboardSkuListQuery } from '../../../../../../contracts/types/dashboardSkuReadModels'
import { buildRunConsoleLogExport, buildRunConsolePage } from '../../run-console/run-console-data'
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

export function getRealAgentChatReadiness(env: Record<string, string | undefined> = process.env) {
  const repositoryStatus = createConversationRepository(env)
  const hasModelAdapter = Boolean(createVercelAiSdkAgentModelAdapterFromEnv(env))
  const missing = [
    repositoryStatus.repository ? null : 'AgentConversationRepository',
    hasModelAdapter ? null : 'AgentModelAdapter',
  ].filter((item): item is string => Boolean(item))
  return {
    ready: missing.length === 0,
    missing,
    conversationStorage: {
      configured: Boolean(repositoryStatus.repository),
      missing: repositoryStatus.missing,
      adapter: repositoryStatus.repository ? 'prisma' : null,
    },
    modelAdapter: {
      configured: hasModelAdapter,
      provider: hasModelAdapter ? 'openai-compatible' : null,
      model: (env.PICKAGENT_AGENT_MODEL ?? env.OPENAI_MODEL ?? 'gpt-4.1-mini').trim() || null,
      baseURLConfigured: Boolean(env.OPENAI_BASE_URL?.trim()),
    },
    toolExecutor: {
      configured: Boolean(repositoryStatus.repository),
      registeredToolCount: defaultAgentToolNames.length,
      writeToolCount: writeAgentTools.size,
      autoAllowedWriteToolCount: autoAllowedWriteAgentTools.size,
    },
  }
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
      {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : undefined,
        errorMeta: typeof error === 'object' && error && 'meta' in error ? (error as { meta?: unknown }).meta as Record<string, unknown> : undefined,
      },
    )
  }
}

function createRealAgentChatRuntime() {
  const repository = createConversationRepository().repository
  return new RealAgentChatRuntime({
    repository,
    modelAdapter: createVercelAiSdkAgentModelAdapterFromEnv(),
    toolExecutor: repository ? createPersistentToolExecutor(repository) : undefined,
  })
}

function createConversationRepository(env: Record<string, string | undefined> = process.env): { repository?: AgentConversationRepository; missing?: string } {
  const local = createLocalPrismaConversationClient(env)
  if (local.client) return { repository: new PrismaAgentConversationRepository(local.client) }

  try {
    const requireFromNode = eval('require') as (id: string) => { PrismaClient: new () => unknown }
    const { PrismaClient } = requireFromNode('@prisma/client')
    const prisma = new PrismaClient()
    assertAgentConversationPrismaClient(prisma)
    return { repository: new PrismaAgentConversationRepository(prisma) }
  } catch {
    return { missing: local.missing ?? 'AgentConversationRepository' }
  }
}

const registeredAgentTools = new Set<string>(defaultAgentToolNames)
const writeAgentTools = new Set(['createRuleSet', 'updateRuleSet', 'createRuleSetVersion', 'createActivity', 'updateActivity', 'startActivityRun', 'addActivityCandidateSkus', 'parseActivityRuleSetForActivity', 'ingestSkus', 'ingestBrowserScan', 'createReviewItems', 'updateReviewItem', 'decideReviewItem', 'setSkuNextAction', 'createConnector', 'updateConnector', 'updateConnectorPermissions', 'runConnectorSync', 'setConnectorStatus', 'setRuleSetStatus', 'retryRun', 'createAgentMission', 'startAgentRun', 'pauseAgentRun', 'cancelAgentRun', 'answerAgentRunQuestion', 'decideAgentReviewGate', 'generateReport', 'compareReports', 'exportReport', 'exportSkuList', 'subscribeReport', 'updateWorkspaceSettings', 'updateToolPolicy', 'updateSettingsUserStatus'])
const autoAllowedWriteAgentTools = new Set(['createReviewItems', 'setSkuNextAction', 'addActivityCandidateSkus', 'parseActivityRuleSetForActivity', 'updateConnectorPermissions', 'runConnectorSync', 'exportReport', 'exportSkuList', 'subscribeReport', 'answerAgentRunQuestion'])
const sensitiveKeyPattern = /cookie|token|jwt|sso|secret|api[_-]?key|authorization|password|credential/i

export function createPersistentToolExecutor(repository: AgentConversationRepository) {
  return async (input: {
    run: { id: string }
    mission: { id: string }
    toolName: string
    inputJson: Record<string, unknown>
    externalToolCallId?: string | null
  }): Promise<AgentConversationToolExecution> => {
    const toolName = normalizeExecutableToolName(input.toolName)
    const safeInput = scrubSensitive(input.inputJson) as Record<string, unknown>
    const policy = await finalApiRuntime.workspaceSettingsService.getToolPolicy(agentToolAuthContext())
    const isDeniedBySettings = isAgentToolDeniedBySettings(toolName, policy)
    if (!registeredAgentTools.has(toolName) || containsSensitive(input.inputJson) || isDeniedBySettings) {
      const reason = containsSensitive(input.inputJson) ? 'sensitive_input_denied' : !registeredAgentTools.has(toolName) ? 'unregistered_tool_denied' : 'tool_policy_denied'
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
        payloadJson: { toolCallId: toolCall.id, toolName, reason, policyVersion: policy.policyVersion },
      })
      return { toolCall, status: 'BLOCKED_BY_POLICY', summary: reason, data: null, evidenceRefs: [], linkedEntities: [], reviewGate: null }
    }

    if (agentToolRequiresReviewGate(toolName)) {
      const toolCall = await repository.createToolCall({
        runId: input.run.id,
        externalToolCallId: input.externalToolCallId ?? null,
        toolName,
        status: 'WAITING_FOR_APPROVAL',
        riskLevel: agentToolRiskLevel(toolName),
        reviewPolicy: 'REVIEW_GATE',
        inputJson: safeInput,
        outputJson: {},
        evidenceRefsJson: { refs: [] },
      })
      const reviewGate = await repository.createReviewGate({
        missionId: input.mission.id,
        runId: input.run.id,
        toolCallId: toolCall.id,
        reasonCode: 'chat_write_tool_requires_review',
        question: `是否允许 Agent 执行 ${toolName}？`,
        agentRecommendation: '该工具会修改业务数据或写入审计记录，需先由人工确认再继续。',
        riskIfApproved: '批准后，Agent 可继续执行该写入类工具并改变系统状态。',
        riskIfRejected: '拒绝后，本次对话只保留建议和证据，不会执行该写入类工具。',
        evidenceRefsJson: { refs: [] },
      })
      await repository.appendRunEvent({
        runId: input.run.id,
        eventType: 'review_gate.opened',
        eventPhase: 'WAITING_FOR_APPROVAL',
        payloadJson: { toolCallId: toolCall.id, gateId: reviewGate.id, toolName },
      })
      return {
        toolCall,
        status: 'WAITING_FOR_APPROVAL',
        summary: `等待人工确认后执行 ${toolName}`,
        data: null,
        evidenceRefs: [],
        linkedEntities: [toConversationLinkedEntity(toolName, { type: 'review_gate', id: reviewGate.id })],
        reviewGate,
      }
    }

    const execution = await executeFinalApiTool(toolName, safeInput)
    const status = execution.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED'
    const evidenceRefs = execution.evidence.map((item, index) => toConversationEvidence(toolName, item, index))
    const linkedEntities = (execution.linkedEntities ?? (execution.linkedEntity ? [execution.linkedEntity] : [])).map((entity) => toConversationLinkedEntity(toolName, entity))
    const summary = summarizeToolOutput(execution.result, execution.trace.map((item) => item.summary).join('；'))
    const toolCall = await repository.createToolCall({
      runId: input.run.id,
      externalToolCallId: input.externalToolCallId ?? null,
      toolName,
      status,
      riskLevel: agentToolRiskLevel(toolName),
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

export function agentToolRiskLevel(toolName: string): 'L1' | 'L2' {
  const normalizedToolName = normalizePolicyToolName(toolName)
  if (autoAllowedWriteAgentTools.has(normalizedToolName)) return 'L1'
  return writeAgentTools.has(normalizedToolName) ? 'L2' : 'L1'
}

export function agentToolRequiresReviewGate(toolName: string): boolean {
  return agentToolRiskLevel(toolName) === 'L2'
}

interface FinalApiToolExecution {
  status: 'SUCCEEDED' | 'FAILED'
  result: unknown
  evidence: EvidenceLinkDto[]
  linkedEntity?: { type: string; id: string }
  linkedEntities?: Array<{ type: string; id: string }>
  trace: Array<{ summary: string }>
}

export function isAgentToolDeniedBySettings(toolName: string, policy: Pick<ToolPolicyDto, 'allowedAgentTools' | 'deniedRuntimeTools'>): boolean {
  const normalizedToolName = normalizePolicyToolName(toolName)
  const allowedTools = new Set(policy.allowedAgentTools.map(normalizePolicyToolName))
  const deniedTools = new Set(policy.deniedRuntimeTools.map(normalizePolicyToolName))
  return deniedTools.has(normalizedToolName) || !allowedTools.has(normalizedToolName)
}

export async function executeFinalApiTool(toolName: string, input: Record<string, unknown>): Promise<FinalApiToolExecution> {
  const executableToolName = normalizeExecutableToolName(toolName)
  if (executableToolName !== toolName) return executeFinalApiTool(executableToolName, input)
  try {
    if (toolName === 'getDashboardContext') {
      const authContext = agentToolAuthContext()
      const pageSize = numberOr(input.pageSize, 8)
      const [healthSummary, skuCandidates, ruleSets, activities] = await Promise.all([
        finalApiRuntime.ingestService.getHealthSummary(authContext),
        finalApiRuntime.ingestService.listSkus(1, pageSize, authContext),
        finalApiRuntime.ruleSetService.list(1, 5, authContext),
        finalApiRuntime.activityService.list(1, 5, authContext),
      ])
      const result = {
        page: 'Dashboard 总览',
        query: { page: 1, pageSize },
        healthSummary,
        skuCandidates: skuCandidates.items.map(toSkuSummaryCandidate),
        skuPage: { page: skuCandidates.page, pageSize: skuCandidates.pageSize, total: skuCandidates.total },
        ruleSets: ruleSets.items.map((item) => ({
          ruleSetId: item.ruleSetId,
          name: item.name,
          type: item.type,
          source: item.source,
          status: item.status,
          version: item.version,
          updatedAt: item.updatedAt,
        })),
        activities: activities.items.map((item) => ({
          activityId: item.activityId,
          name: item.name,
          platform: item.platform,
          status: item.status,
          startAt: item.startAt,
          endAt: item.endAt,
        })),
        recommendedNextTools: ['searchSkus', 'getSkuSummary', 'diagnoseSkuHealth', 'checkDataFreshness', 'simulateActivityReadiness'],
      }
      return succeeded(result, dashboardEvidence(result), `读取 Dashboard 上下文：${skuCandidates.total} 个 SKU 候选`, { type: 'dashboard', id: 'dashboard' })
    }

    if (toolName === 'getHealthSummary') {
      const result = await finalApiRuntime.ingestService.getHealthSummary(agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: 'health-summary', label: '健康汇总', summary: `总计 ${result.total} 个 SKU，通过 ${result.ready}，预警 ${result.warning}，阻断 ${result.blocked}` }], `读取健康汇总：${result.total} 个 SKU`, { type: 'dashboard', id: 'health-summary' })
    }

    if (toolName === 'listRunConsole') {
      const pageSize = Math.min(numberOr(input.pageSize, 20), 50)
      const result = await buildRunConsolePage(agentToolAuthContext(), pageSize)
      const typeFilter = optionalString(input.type)
      const statusFilter = optionalString(input.status)
      const items = result.items.filter((item) => {
        if (typeFilter && item.type !== typeFilter) return false
        if (statusFilter && item.status !== statusFilter) return false
        return true
      })
      const filtered = { ...result, items, total: items.length, pageSize }
      return succeeded(filtered, items.slice(0, 5).map((item) => ({ type: 'tool_trace', entityId: item.runId, label: item.type, summary: item.summary })), `读取 Run Console：${items.length} 条运行记录`, { type: 'dashboard', id: 'run-console' })
    }

    if (toolName === 'exportRunLogs') {
      const runId = String(input.runId ?? '')
      if (!runId) throw new Error('runId is required')
      const result = await buildRunConsoleLogExport(agentToolAuthContext(), runId)
      if (!result) throw new Error(`Run not found: ${runId}`)
      return succeeded(result, [{ type: 'tool_trace', entityId: runId, label: 'Run 日志导出', summary: `导出 ${result.lineCount} 行日志：${result.fileName}` }], `导出 Run 日志：${result.runId}`, { type: 'workflow_run', id: result.runId })
    }

    if (toolName === 'searchSkus') {
      const query = skuListQueryFromToolInput(input, 10)
      const result = await finalApiRuntime.skuReadinessQueryService.list(query, agentToolAuthContext())
      const payload = {
        query,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        items: result.items.map(toSkuCandidate),
      }
      return succeeded(payload, skuListEvidence(payload.items), `查询 SKU：命中 ${result.total} 条`, result.items[0] ? { type: 'sku_profile', id: result.items[0].skuProfileId } : { type: 'dashboard', id: 'sku-search' })
    }

    if (toolName === 'exportSkuList') {
      const query = skuListQueryFromToolInput(input, 500)
      const result = await finalApiRuntime.skuReadinessQueryService.exportList(query, agentToolAuthContext())
      const evidence: EvidenceLinkDto[] = [{
        type: 'tool_trace',
        entityId: result.workflowRunId ?? result.fileName,
        label: 'SKU 导出',
        summary: `导出 ${result.rowCount} 行 SKU，文件 ${result.fileName}`,
      }]
      const linkedEntity = result.workflowRunId ? { type: 'workflow_run', id: result.workflowRunId } : { type: 'dashboard', id: 'sku-export' }
      return succeeded(result, evidence, `导出 SKU：${result.rowCount} 行`, linkedEntity, result.artifactHref ? [{ type: 'download_artifact', id: result.artifactHref }, linkedEntity] : undefined)
    }

    if (toolName === 'listRuleSets') {
      const result = await finalApiRuntime.ruleSetService.list(numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext(), {
        q: optionalString(input.q ?? input.query ?? input.keyword),
        status: normalizeRuleSetListStatus(input.status),
      })
      return succeeded(result, [{ type: 'rule', entityId: 'rule-sets', label: '规则集列表', summary: `读取 ${result.items.length} 个规则集` }], `读取规则集：${result.items.length} 个`, result.items[0] ? { type: 'rule_set', id: result.items[0].ruleSetId } : { type: 'dashboard', id: 'rule-sets' })
    }

    if (toolName === 'getRuleSetDetail') {
      const ruleSetId = String(input.ruleSetId ?? '')
      if (!ruleSetId) throw new Error('ruleSetId is required')
      const result = await finalApiRuntime.ruleSetService.get(ruleSetId, agentToolAuthContext())
      if (!result) throw new Error(`Rule set not found: ${ruleSetId}`)
      return succeeded(result, [{ type: 'rule', entityId: ruleSetId, label: result.name, summary: `${result.version} / ${result.status} / ${result.summary.ruleCount} 条规则` }], `读取规则集详情：${result.name}`, { type: 'rule_set', id: ruleSetId })
    }

    if (toolName === 'listRuleSetVersions') {
      const ruleSetId = String(input.ruleSetId ?? '')
      if (!ruleSetId) throw new Error('ruleSetId is required')
      const result = await finalApiRuntime.ruleSetService.listVersions(ruleSetId, agentToolAuthContext())
      return succeeded(
        { items: result, total: result.length, page: 1, pageSize: result.length },
        result.slice(0, 5).map((item) => ({ type: 'rule', entityId: item.ruleSetVersionId, label: item.version, summary: `${item.status} / ${item.createdAt}` })),
        `读取规则集版本：${result.length} 个`,
        { type: 'rule_set', id: ruleSetId },
      )
    }

    if (toolName === 'createRuleSet') {
      const request = createRuleSetInput(input)
      const result = await finalApiRuntime.ruleSetService.create(request, agentToolAuthContext())
      const ruleSetEntity = { type: 'rule_set', id: result.ruleSetId }
      const workflowEntity = workflowLinkedEntity(result, ruleSetEntity)
      return succeeded(result, [{ type: 'rule', entityId: result.ruleSetId, label: result.name, summary: `${result.status} / ${result.summary.ruleCount} 条规则` }], `创建规则集：${result.name}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [ruleSetEntity, workflowEntity] : undefined)
    }

    if (toolName === 'updateRuleSet') {
      const ruleSetId = String(input.ruleSetId ?? '')
      if (!ruleSetId) throw new Error('ruleSetId is required')
      const request = updateRuleSetInput(input)
      const result = await finalApiRuntime.ruleSetService.update(ruleSetId, request, agentToolAuthContext())
      const ruleSetEntity = { type: 'rule_set', id: ruleSetId }
      const workflowEntity = workflowLinkedEntity(result, ruleSetEntity)
      return succeeded(result, [{ type: 'rule', entityId: ruleSetId, label: result.name, summary: `${result.version} / ${result.status}` }], `更新规则集：${result.name}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [ruleSetEntity, workflowEntity] : undefined)
    }

    if (toolName === 'createRuleSetVersion') {
      const ruleSetId = String(input.ruleSetId ?? '')
      if (!ruleSetId) throw new Error('ruleSetId is required')
      const result = await finalApiRuntime.ruleSetService.createVersion(ruleSetId, agentToolAuthContext())
      const ruleSetEntity = { type: 'rule_set', id: ruleSetId }
      const workflowEntity = workflowLinkedEntity(result, ruleSetEntity)
      return succeeded(result, [{ type: 'rule', entityId: ruleSetId, label: '规则集版本', summary: `创建版本：${result.version}` }], `创建规则集版本：${result.version}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [ruleSetEntity, workflowEntity] : undefined)
    }

    if (toolName === 'listActivities') {
      const result = await finalApiRuntime.activityService.list(numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: 'activities', label: '活动列表', summary: `读取 ${result.items.length} 个活动` }], `读取活动：${result.items.length} 个`, result.items[0] ? { type: 'activity', id: result.items[0].activityId } : { type: 'dashboard', id: 'activities' })
    }

    if (toolName === 'createActivity') {
      const request = activityCreateInput(input)
      const result = await finalApiRuntime.activityService.create(request, agentToolAuthContext())
      const activityEntity = { type: 'activity', id: result.activityId }
      const workflowEntity = activityWorkflowEntity(result, activityEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.activityId, label: '活动创建', summary: `${result.name} / ${result.status}` }], `创建活动：${result.name}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [activityEntity, workflowEntity] : undefined)
    }

    if (toolName === 'updateActivity') {
      const activityId = String(input.activityId ?? '')
      if (!activityId) throw new Error('activityId is required')
      const result = await finalApiRuntime.activityService.update(activityId, activityUpdateInput(input), agentToolAuthContext())
      const activityEntity = { type: 'activity', id: result.activityId }
      const workflowEntity = activityWorkflowEntity(result, activityEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.activityId, label: '活动更新', summary: `${result.name} / ${result.status}` }], `更新活动：${result.name}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [activityEntity, workflowEntity] : undefined)
    }

    if (toolName === 'getActivityExecutionPlan') {
      const activityId = String(input.activityId ?? '')
      if (!activityId) throw new Error('activityId is required')
      const result = await finalApiRuntime.activityService.executionPlan(activityId, agentToolAuthContext())
      if (!result) throw new Error(`activity not found: ${activityId}`)
      return succeeded(result, [{ type: 'tool_trace', entityId: activityId, label: '活动执行计划', summary: `步骤 ${result.steps.length} 个，待确认 ${result.pendingConfirmations.length} 个` }], `读取活动执行计划：${result.steps.length} 个步骤`, { type: 'activity', id: activityId })
    }

    if (toolName === 'getActivitySimulationRunDetail') {
      const activityId = String(input.activityId ?? '')
      const ruleSetId = String(input.ruleSetId ?? input.activityRuleSetId ?? '')
      const simulationRunId = String(input.simulationRunId ?? input.runId ?? '')
      if (!simulationRunId || (!activityId && !ruleSetId)) throw new Error('activityId or ruleSetId, and simulationRunId are required')
      if (ruleSetId && !activityId) {
        const result = await finalApiRuntime.activityService.simulationRunForRuleSet(ruleSetId, simulationRunId, agentToolAuthContext())
        if (!result) throw new Error(`Rule set simulation run not found: ${ruleSetId}/${simulationRunId}`)
        const evidence = result.results.flatMap((item) => item.evidence)
        const simulationEntity = { type: 'simulation_run', id: simulationLinkedEntityId(ruleSetId, simulationRunId) }
        const ruleSetEntity = { type: 'rule_set', id: ruleSetId }
        return succeeded(result, evidence, `读取规则集模拟详情：${result.results.length} 个 SKU`, simulationEntity, [ruleSetEntity, simulationEntity])
      }
      const result = await finalApiRuntime.activityService.simulationDetail(activityId, simulationRunId, agentToolAuthContext())
      if (!result) throw new Error(`Activity simulation run not found: ${activityId}/${simulationRunId}`)
      const evidence = result.results.flatMap((item) => item.evidence)
      const simulationEntity = { type: 'simulation_run', id: simulationRunId }
      const activityEntity = { type: 'activity', id: activityId }
      return succeeded(result, evidence, `读取活动模拟详情：${result.results.length} 个 SKU`, simulationEntity, [activityEntity, simulationEntity])
    }

    if (toolName === 'startActivityRun') {
      const activityId = String(input.activityId ?? '')
      if (!activityId) throw new Error('activityId is required')
      const result = await finalApiRuntime.activityService.startRun(activityId, agentToolAuthContext())
      const activityEntity = { type: 'activity', id: activityId }
      const workflowEntity = result.runId ? { type: 'workflow_run', id: result.runId } : activityEntity
      return succeeded(result, [{ type: 'tool_trace', entityId: result.runId ?? activityId, label: '活动运行', summary: `活动运行已启动：${result.runId ?? '-'}` }], `启动活动运行：${result.runId ?? activityId}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [activityEntity, workflowEntity] : undefined)
    }

    if (toolName === 'addActivityCandidateSkus') {
      const activityId = String(input.activityId ?? '')
      const skuProfileIds = stringArray(input.skuProfileIds)
      if (!activityId || !skuProfileIds.length) throw new Error('activityId and skuProfileIds are required')
      const result = await finalApiRuntime.activityService.addCandidateSkus(activityId, skuProfileIds, {
        reasonCode: optionalString(input.reasonCode),
        comment: optionalString(input.comment),
      }, agentToolAuthContext())
      const activityEntity = { type: 'activity', id: activityId }
      const workflowEntity = { type: 'workflow_run', id: result.workflowRunId }
      return succeeded(result, [{ type: 'tool_trace', entityId: activityId, label: '活动候选清单', summary: `新增 ${result.addedSkuProfileIds.length} 个 SKU，候选共 ${result.skuProfileIds.length} 个` }], `加入活动候选清单：${result.addedSkuProfileIds.length} 个`, workflowEntity, [activityEntity, workflowEntity])
    }

    if (toolName === 'getSkuSummary') {
      const detail = await getRequiredSkuDetail(String(input.skuProfileId ?? ''))
      return succeeded(detail, detail.evidence, `读取 SKU：${detail.productName}`, { type: 'sku_profile', id: detail.skuProfileId })
    }

    if (toolName === 'ingestSkus') {
      const request = ingestPayloadInput(input)
      const result = await finalApiRuntime.ingestService.ingest(request, agentToolAuthContext())
      const skuEntities = result.summaries.map((item) => ({ type: 'sku_profile', id: item.skuProfileId }))
      const workflowEntity = workflowLinkedEntity(result, skuEntities[0] ?? { type: 'dashboard', id: 'sku-ingest' })
      return succeeded(result, result.summaries.map((item) => ({ type: 'tool_trace', entityId: item.skuProfileId, label: item.productName, summary: `写入 SKU：${item.healthStatus} / ${item.healthScore}` })), `写入 SKU 采集数据：${result.summaries.length} 条`, workflowEntity, workflowEntity.type === 'workflow_run' ? [...skuEntities, workflowEntity] : undefined)
    }

    if (toolName === 'checkDataFreshness') {
      const detail = await getRequiredSkuDetail(String(input.skuProfileId ?? ''))
      const maxAgeHours = numberOr(input.maxAgeHours, 24)
      const collectedAt = detail.latestSnapshot?.collectedAt ?? null
      const ageHours = collectedAt ? Math.max(0, Math.round((Date.now() - new Date(collectedAt).getTime()) / 3_600_000)) : null
      const isFresh = ageHours !== null && ageHours <= maxAgeHours
      const result = {
        skuProfileId: detail.skuProfileId,
        snapshotId: detail.latestSnapshot?.snapshotId ?? null,
        collectedAt,
        checkedAt: new Date().toISOString(),
        maxAgeHours,
        ageHours,
        isFresh,
        reason: isFresh ? `当前快照 ${ageHours} 小时内采集，满足 freshness 要求` : '当前快照缺失或超过 freshness 要求',
        evidence: detail.evidence,
      }
      return succeeded(result, detail.evidence, `数据新鲜度：${isFresh ? 'fresh' : 'stale'}`, { type: 'sku_profile', id: detail.skuProfileId })
    }

    if (toolName === 'diagnoseSkuHealth') {
      const detail = await getRequiredSkuDetail(String(input.skuProfileId ?? ''))
      const result = detail.latestDiagnosis ?? {
        skuProfileId: detail.skuProfileId,
        healthStatus: detail.healthStatus,
        healthScore: detail.healthScore,
        dataQualityScore: detail.dataQualityScore,
        issues: detail.topIssues,
        nextActions: detail.nextActions,
        evidence: detail.evidence,
      }
      return succeeded(result, detail.evidence, `健康状态：${detail.healthStatus}`, { type: 'sku_profile', id: detail.skuProfileId })
    }

    if (toolName === 'parseActivityRules') {
      const sourceText = String(input.sourceText ?? input.ruleText ?? '')
      if (!sourceText.trim()) throw new Error('sourceText is required')
      const result = await finalApiRuntime.activityService.parse({
        name: String(input.name ?? 'Agent 解析活动规则'),
        platform: typeof input.platform === 'string' ? input.platform : undefined,
        sourceText,
      }, agentToolAuthContext())
      const ruleSetEntity = { type: 'rule_set', id: result.ruleSetId }
      const workflowEntity = workflowLinkedEntity(result, ruleSetEntity)
      return succeeded(result, result.errors.length ? [] : [{ type: 'rule', entityId: result.ruleSetId, label: result.name, summary: `规则解析状态：${result.parseStatus}` }], `解析规则：${result.parseStatus}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [ruleSetEntity, workflowEntity] : undefined)
    }

    if (toolName === 'parseActivityRuleSetForActivity') {
      const activityId = String(input.activityId ?? '')
      const sourceText = String(input.sourceText ?? input.ruleText ?? '')
      if (!activityId || !sourceText.trim()) throw new Error('activityId and sourceText are required')
      const rules = recordArray(input.rules) as unknown as CanonicalRuleDto[]
      const result = await finalApiRuntime.activityService.parseForActivity(activityId, {
        name: optionalString(input.name),
        sourceText,
        rules: rules.length ? rules : undefined,
      }, agentToolAuthContext())
      const activityEntity = { type: 'activity', id: result.activityId }
      const ruleSetEntity = { type: 'rule_set', id: result.ruleSet.ruleSetId }
      return succeeded(result, [{ type: 'rule', entityId: result.ruleSet.ruleSetId, label: `活动规则 ${result.ruleSet.version}`, summary: `已绑定活动 ${activityId}，规则 ${result.ruleSet.rules.length} 条` }], `解析并绑定活动规则：${result.ruleSet.ruleSetId}`, activityEntity, [activityEntity, ruleSetEntity])
    }

    if (toolName === 'simulateActivityReadiness') {
      const ruleSetId = String(input.ruleSetId ?? input.activityRuleSetId ?? '')
      const skuProfileIds = stringArray(input.skuProfileIds)
      if (!ruleSetId || skuProfileIds.length === 0) throw new Error('ruleSetId and skuProfileIds are required')
      const result = await finalApiRuntime.activityService.simulate(ruleSetId, {
        skuProfileIds,
        whatIf: isRecord(input.whatIf) ? input.whatIf : undefined,
      }, agentToolAuthContext())
      const evidence = result.results.flatMap((item) => item.evidence)
      const simulationEntity = { type: 'simulation_run', id: simulationLinkedEntityId(ruleSetId, result.simulationRunId) }
      const ruleSetEntity = { type: 'rule_set', id: ruleSetId }
      const workflowEntity = workflowLinkedEntity(result, simulationEntity)
      return succeeded(result, evidence, `模拟完成：${result.results.length} 个 SKU`, workflowEntity, workflowEntity.type === 'workflow_run' ? [simulationEntity, ruleSetEntity, workflowEntity] : undefined)
    }

    if (toolName === 'explainDecisionWithEvidence') {
      const detail = await getRequiredSkuDetail(String(input.skuProfileId ?? ''))
      const result = {
        skuProfileId: detail.skuProfileId,
        summary: `${detail.productName} 当前健康状态为 ${detail.healthStatus}，健康分 ${detail.healthScore}。`,
        recommendation: detail.nextActions.join('；') || '当前没有待处理动作',
        evidence: detail.evidence,
        nextActions: detail.nextActions,
      }
      return succeeded(result, detail.evidence, `解释决策：${detail.productName}`, { type: 'sku_profile', id: detail.skuProfileId })
    }

    if (toolName === 'generateReport') {
      const skuProfileIds = await reportSkuProfileIdsFromInput(input)
      if (skuProfileIds.length === 0) throw new Error('skuProfileIds are required')
      const result = await finalApiRuntime.reportService.generate({
        type: input.type === 'HEALTH' ? 'HEALTH' : 'ACTIVITY',
        skuProfileIds,
        simulationResultIds: stringArray(input.simulationResultIds),
      }, agentToolAuthContext())
      const reportEntity = { type: 'report', id: result.reportId }
      const workflowEntity = workflowLinkedEntity(result, reportEntity)
      return succeeded(result, result.evidenceSummary, `生成报告：${result.title}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [reportEntity, workflowEntity] : undefined)
    }

    if (toolName === 'listReviews') {
      const query: ReviewListQueryDto = {
        page: numberOr(input.page, 1),
        pageSize: numberOr(input.pageSize, 20),
        tab: optionalString(input.tab ?? input.status) as ReviewListQueryDto['tab'],
        type: optionalString(input.reviewType ?? input.type) as ReviewListQueryDto['type'],
        riskLevel: optionalString(input.reviewRiskLevel) as ReviewListQueryDto['riskLevel'],
        status: optionalString(input.status),
        assigneeRole: optionalString(input.assigneeRole),
        dueFrom: optionalString(input.dueFrom),
        dueTo: optionalString(input.dueTo),
        q: optionalString(input.q ?? input.query ?? input.keyword),
      }
      const result = await finalApiRuntime.reviewService.list(query, agentToolAuthContext())
      return succeeded(result, result.items.slice(0, 5).map((item) => ({ type: 'review', entityId: item.reviewItemId, label: item.title, summary: `${item.status} / ${item.riskLevel} / ${item.summary}` })), `读取 Review 列表：${result.total} 条`, result.items[0] ? { type: 'review_item', id: result.items[0].reviewItemId } : { type: 'dashboard', id: 'reviews' })
    }

    if (toolName === 'createReviewItems') {
      const items = await reviewCreateItemsInput(input)
      const result = await finalApiRuntime.reviewService.create(items, agentToolAuthContext())
      const reviewEntity = result[0] ? { type: 'review_item', id: result[0].reviewItemId } : undefined
      const firstDetail = result[0] ? await finalApiRuntime.reviewService.getDetail(result[0].reviewItemId, agentToolAuthContext()) : null
      const workflowEntity = reviewEntity ? workflowLinkedEntity(latestReviewWorkflow(firstDetail), reviewEntity) : undefined
      return succeeded(result, result.flatMap((created) => created.evidence), `创建 Review：${result.map((created) => created.reviewItemId).join(', ')}`, workflowEntity, workflowEntity?.type === 'workflow_run' && reviewEntity ? [reviewEntity, workflowEntity] : undefined)
    }

    if (toolName === 'getReviewDetail') {
      const reviewItemId = String(input.reviewItemId ?? input.sourceId ?? '')
      if (!reviewItemId) throw new Error('reviewItemId is required')
      const result = await finalApiRuntime.reviewService.getDetail(reviewItemId, agentToolAuthContext())
      if (!result) throw new Error(`Review item not found: ${reviewItemId}`)
      return succeeded(result, result.evidenceRefs.map(reviewEvidenceToAgentEvidence), `读取 Review：${result.reviewItemId} / ${result.status}`, { type: 'review_item', id: result.reviewItemId })
    }

    if (toolName === 'updateReviewItem') {
      const reviewItemId = String(input.reviewItemId ?? input.sourceId ?? '')
      if (!reviewItemId) throw new Error('reviewItemId is required')
      const result = await finalApiRuntime.reviewService.update(reviewItemId, reviewPatchInput(input), agentToolAuthContext())
      const reviewEntity = { type: 'review_item', id: result.reviewItemId }
      const workflowEntity = workflowLinkedEntity(latestReviewWorkflow(result), reviewEntity)
      return succeeded(result, result.evidenceRefs.map(reviewEvidenceToAgentEvidence), `更新 Review：${result.reviewItemId}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [reviewEntity, workflowEntity] : undefined)
    }

    if (toolName === 'decideReviewItem') {
      const reviewItemId = String(input.reviewItemId ?? input.sourceId ?? '')
      if (!reviewItemId) throw new Error('reviewItemId is required')
      const request: ReviewDecisionRequestDto = {
        decision: normalizeReviewDecision(input.decision),
        decisionBy: optionalString(input.decisionBy) ?? 'agent-chat-tool',
        decisionComment: optionalString(input.decisionComment) ?? optionalString(input.comment) ?? 'Agent Copilot 执行 Review 决策',
        modifiedPayload: isRecord(input.modifiedPayload) ? input.modifiedPayload : undefined,
      }
      const result = await finalApiRuntime.reviewService.decide(reviewItemId, request, agentToolAuthContext())
      const reviewEntity = { type: 'review_item', id: result.reviewItemId }
      const workflowEntity = workflowLinkedEntity(latestReviewWorkflow(result), reviewEntity)
      return succeeded(result, result.evidenceRefs.map(reviewEvidenceToAgentEvidence), `Review 决策：${result.reviewItemId} -> ${result.status}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [reviewEntity, workflowEntity] : undefined)
    }

    if (toolName === 'setSkuNextAction') {
      const skuProfileId = String(input.skuProfileId ?? '')
      if (!skuProfileId) throw new Error('skuProfileId is required')
      const nextAction = normalizeNextAction(input)
      const result = await finalApiRuntime.skuReadinessQueryService.updateNextAction(skuProfileId, { nextAction, comment: optionalString(input.comment) ?? 'agent-chat-tool' }, agentToolAuthContext())
      const skuEntity = { type: 'sku_profile', id: skuProfileId }
      const workflowEntity = workflowLinkedEntity(result, skuEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: skuProfileId, label: 'SKU 下一步设置', summary: `下一步已设置为：${result.statusSummary.nextStep}` }], `设置 SKU 下一步：${result.statusSummary.nextStep}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [skuEntity, workflowEntity] : undefined)
    }

    if (toolName === 'listConnectors') {
      const result = await finalApiRuntime.connectorService.list(numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: 'connectors', label: '连接器列表', summary: `读取 ${result.items.length} 个连接器` }], `读取连接器：${result.items.length} 个`, result.items[0] ? { type: 'connector', id: result.items[0].connectorId } : { type: 'dashboard', id: 'connectors' })
    }

    if (toolName === 'getConnectorDetail') {
      const connectorId = String(input.connectorId ?? '')
      if (!connectorId) throw new Error('connectorId is required')
      const result = await finalApiRuntime.connectorService.get(connectorId, agentToolAuthContext())
      if (!result) throw new Error(`Connector not found: ${connectorId}`)
      return succeeded(result, [{ type: 'tool_trace', entityId: connectorId, label: '连接器详情', summary: `${result.name} / ${result.kind} / ${result.status}` }], `读取连接器详情：${result.name}`, { type: 'connector', id: connectorId })
    }

    if (toolName === 'listConnectorRuns') {
      const connectorId = String(input.connectorId ?? '')
      if (!connectorId) throw new Error('connectorId is required')
      const result = await finalApiRuntime.connectorService.listRuns(connectorId, numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext())
      const connectorEntity = { type: 'connector', id: connectorId }
      const runEntity = result.items[0] ? { type: 'workflow_run', id: result.items[0].workflowRunRef?.entityId ?? result.items[0].connectorRunId } : connectorEntity
      return succeeded(result, result.items.slice(0, 5).map((item) => ({ type: 'tool_trace', entityId: item.connectorRunId, label: '连接器运行', summary: `${item.status} / ${item.rowCount} 行 / 质量 ${item.qualityScore ?? '-'}` })), `读取连接器运行列表：${result.total} 条`, runEntity, runEntity.type === 'workflow_run' ? [connectorEntity, runEntity] : undefined)
    }

    if (toolName === 'getConnectorRunDetail') {
      const connectorRunId = String(input.connectorRunId ?? input.runId ?? '')
      if (!connectorRunId) throw new Error('connectorRunId is required')
      const result = await finalApiRuntime.connectorService.getRun(connectorRunId, agentToolAuthContext())
      if (!result) throw new Error(`Connector run not found: ${connectorRunId}`)
      const connectorEntity = { type: 'connector', id: result.connectorId }
      const runEntity = { type: 'workflow_run', id: result.workflowRunRef?.entityId ?? connectorRunId }
      return succeeded(result, [{ type: 'tool_trace', entityId: connectorRunId, label: '连接器运行详情', summary: `${result.status} / ${result.rowCount} 行 / 质量 ${result.qualityScore ?? '-'}` }], `读取连接器运行：${connectorRunId}`, runEntity, [connectorEntity, runEntity])
    }

    if (toolName === 'createConnector') {
      const request = createConnectorInput(input)
      const result = await finalApiRuntime.connectorService.create(request, agentToolAuthContext())
      const connectorEntity = { type: 'connector', id: result.connectorId }
      const workflowEntity = workflowLinkedEntity(result, connectorEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.connectorId, label: '创建连接器', summary: `${result.name} / ${result.kind} / ${result.status}` }], `创建连接器：${result.name}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [connectorEntity, workflowEntity] : undefined)
    }

    if (toolName === 'updateConnector') {
      const connectorId = String(input.connectorId ?? '')
      if (!connectorId) throw new Error('connectorId is required')
      const request = updateConnectorInput(input)
      const result = await finalApiRuntime.connectorService.update(connectorId, request, agentToolAuthContext())
      const connectorEntity = { type: 'connector', id: connectorId }
      const workflowEntity = workflowLinkedEntity(result, connectorEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: connectorId, label: '更新连接器', summary: `${result.name} / ${result.status}` }], `更新连接器：${result.name}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [connectorEntity, workflowEntity] : undefined)
    }

    if (toolName === 'updateConnectorPermissions') {
      const connectorId = String(input.connectorId ?? '')
      const permissions = stringArray(input.permissions ?? input.permissionKeys)
      if (!connectorId || !permissions.length) throw new Error('connectorId and permissions are required')
      const current = await finalApiRuntime.connectorService.get(connectorId, agentToolAuthContext())
      if (!current) throw new Error(`Connector not found: ${connectorId}`)
      const result = await finalApiRuntime.connectorService.update(connectorId, {
        config: {
          ...current.config,
          permissions,
          permissionsChangedFrom: 'agent-chat-tool',
          permissionsChangedAt: new Date().toISOString(),
        },
      }, agentToolAuthContext())
      const connectorEntity = { type: 'connector', id: connectorId }
      const workflowEntity = workflowLinkedEntity(result, connectorEntity)
      const granted = result.permissions.filter((item) => item.granted).map((item) => item.key)
      return succeeded(result, [{ type: 'tool_trace', entityId: connectorId, label: '连接器权限', summary: `已授权：${granted.join(', ') || 'none'}` }], `更新连接器权限：${result.permissionSummary}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [connectorEntity, workflowEntity] : undefined)
    }

    if (toolName === 'detectBrowserPage') {
      const request = browserPageDetectionInput(input)
      const result = finalApiRuntime.browserConnectorService.detectPage(request)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.traceRef.entityId, label: '浏览器页面识别', summary: `${result.pageType} / ${result.platform ?? 'unknown'} / ${result.reason}` }], `页面识别：${result.supported ? '可采集' : '需确认'}，置信度 ${result.confidence}`, { type: 'connector', id: result.traceRef.entityId })
    }

    if (toolName === 'previewBrowserScan') {
      const request = browserScanPreviewInput(input)
      const result = finalApiRuntime.browserConnectorService.scanPreview(request)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.detected.traceRef.entityId, label: '浏览器扫描预览', summary: `行数 ${result.rowCount}，质量分 ${result.qualityScore}，ready=${result.ingestReady}` }], `扫描预览：${result.rowCount} 行，质量分 ${result.qualityScore}`, result.connectorId ? { type: 'connector', id: result.connectorId } : { type: 'connector', id: result.detected.traceRef.entityId })
    }

    if (toolName === 'ingestBrowserScan') {
      const request = browserScanPreviewInput(input)
      const preview = finalApiRuntime.browserConnectorService.scanPreview(request)
      if (!preview.ingestReady) throw new Error(`Browser scan is not ingest ready: ${preview.warnings.join('；') || 'unknown warning'}`)
      const ingest = await finalApiRuntime.ingestService.ingest(browserScanIngestPayload(input, preview.detected.platform), agentToolAuthContext())
      const run = request.connectorId
        ? await finalApiRuntime.connectorService.createSyncRun(request.connectorId, {
          rowCount: ingest.summaries.length,
          qualityScore: preview.qualityScore / 100,
          warnings: preview.warnings,
          summary: {
            source: 'agent_browser_scan_ingest',
            url: request.url,
            workflowRunId: ingest.workflowRunId,
            skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
          },
        }, agentToolAuthContext())
        : null
      const result = { preview, ingest, run }
      const skuEntities = ingest.summaries.map((item) => ({ type: 'sku_profile', id: item.skuProfileId }))
      const ingestWorkflowEntity = workflowLinkedEntity(ingest, skuEntities[0] ?? { type: 'dashboard', id: 'browser-scan-ingest' })
      const connectorEntity = request.connectorId ? { type: 'connector', id: request.connectorId } : undefined
      const runWorkflowEntity = run ? connectorRunWorkflowEntity(run, connectorEntity ?? ingestWorkflowEntity) : ingestWorkflowEntity
      const linkedEntities = [
        ...skuEntities,
        ...(connectorEntity ? [connectorEntity] : []),
        ...(ingestWorkflowEntity.type === 'workflow_run' ? [ingestWorkflowEntity] : []),
        ...(runWorkflowEntity.type === 'workflow_run' && runWorkflowEntity.id !== ingestWorkflowEntity.id ? [runWorkflowEntity] : []),
      ]
      return succeeded(result, ingest.summaries.map((item) => ({ type: 'tool_trace', entityId: item.skuProfileId, label: item.productName, summary: `浏览器扫描写入 SKU：${item.healthStatus} / ${item.healthScore}` })), `浏览器扫描写入 SKU：${ingest.summaries.length} 条`, runWorkflowEntity, linkedEntities.length ? linkedEntities : undefined)
    }

    if (toolName === 'runConnectorSync') {
      const connectorId = String(input.connectorId ?? '')
      if (!connectorId) throw new Error('connectorId is required')
      const runInput: CreateConnectorSyncRunDto = {
        rowCount: optionalNumber(input.rowCount),
        qualityScore: optionalNumber(input.qualityScore),
        warnings: stringArray(input.warnings),
        summary: isRecord(input.summary) ? input.summary : { source: 'agent-chat-tool' },
      }
      const result = await finalApiRuntime.connectorService.createSyncRun(connectorId, runInput, agentToolAuthContext())
      const connectorEntity = { type: 'connector', id: connectorId }
      const workflowEntity = connectorRunWorkflowEntity(result, connectorEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.connectorRunId, label: '连接器采集运行', summary: `状态：${result.status}，行数：${result.rowCount}` }], `创建连接器采集运行：${result.connectorRunId}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [connectorEntity, workflowEntity] : undefined)
    }

    if (toolName === 'setConnectorStatus') {
      const connectorId = String(input.connectorId ?? '')
      if (!connectorId) throw new Error('connectorId is required')
      const status = input.status === 'DISABLED' || input.status === 'INACTIVE' || input.status === 'NEEDS_AUTH' || input.status === 'FAILED' ? input.status : 'ACTIVE'
      const result = await finalApiRuntime.connectorService.update(connectorId, {
        status,
        config: isRecord(input.config) ? input.config : undefined,
      }, agentToolAuthContext())
      const connectorEntity = { type: 'connector', id: connectorId }
      const workflowEntity = workflowLinkedEntity(result, connectorEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: connectorId, label: '连接器状态', summary: `连接器状态已更新为：${result.status}` }], `更新连接器状态：${result.status}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [connectorEntity, workflowEntity] : undefined)
    }

    if (toolName === 'setRuleSetStatus') {
      const ruleSetId = String(input.ruleSetId ?? '')
      if (!ruleSetId) throw new Error('ruleSetId is required')
      const status = normalizeRuleSetStatus(input.status)
      const result = await finalApiRuntime.ruleSetService.setStatus(ruleSetId, status, agentToolAuthContext())
      const ruleSetEntity = { type: 'rule_set', id: ruleSetId }
      const workflowEntity = workflowLinkedEntity(result, ruleSetEntity)
      return succeeded(result, [{ type: 'rule', entityId: ruleSetId, label: '规则集状态', summary: `规则集状态已更新为：${result.status}` }], `更新规则集状态：${result.status}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [ruleSetEntity, workflowEntity] : undefined)
    }

    if (toolName === 'retryRun') {
      const runType = String(input.runType ?? input.type ?? '')
      const sourceId = String(input.sourceId ?? input.connectorId ?? input.missionId ?? '')
      const retryOf = optionalString(input.runId)
      if (!sourceId) throw new Error('sourceId is required')
      if (runType === 'connector_sync' || input.connectorId) {
        const result = await finalApiRuntime.connectorService.createSyncRun(sourceId, {
          rowCount: optionalNumber(input.rowCount),
          qualityScore: optionalNumber(input.qualityScore),
          warnings: ['Agent 请求重试运行', ...stringArray(input.warnings)],
          summary: { retryOf, triggeredBy: 'agent-chat-tool', ...(isRecord(input.summary) ? input.summary : {}) },
        }, agentToolAuthContext())
        const connectorEntity = { type: 'connector', id: sourceId }
        const workflowEntity = connectorRunWorkflowEntity(result, connectorEntity)
        return succeeded(result, [{ type: 'tool_trace', entityId: result.connectorRunId, label: '连接器重试运行', summary: `重试来源：${retryOf ?? '未指定'}，状态：${result.status}` }], `创建连接器重试运行：${result.connectorRunId}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [connectorEntity, workflowEntity] : undefined)
      }
      if (runType === 'agent_run' || input.missionId) {
        const result = finalAgentRuntime.agentService.startRun(sourceId, {
          modelProvider: optionalString(input.modelProvider) ?? 'pi',
          modelName: optionalString(input.modelName) ?? 'sku-ready-agent',
          inputJson: { retryOf, triggeredBy: 'agent-chat-tool', ...(isRecord(input.inputJson) ? input.inputJson : {}) },
        })
        const runEntity = { type: 'workflow_run', id: result.id }
        const missionEntity = { type: 'agent_mission', id: result.missionId }
        return succeeded(result, [{ type: 'tool_trace', entityId: result.id, label: 'Agent 重试运行', summary: `重试来源：${retryOf ?? '未指定'}，状态：${result.status}` }], `创建 Agent 重试运行：${result.id}`, runEntity, [missionEntity, runEntity])
      }
      if (runType === 'activity_simulation' || input.ruleSetId) {
        const skuProfileIds = stringArray(input.skuProfileIds)
        if (!skuProfileIds.length) throw new Error('skuProfileIds are required for activity_simulation retry')
        const result = await finalApiRuntime.activityService.simulate(sourceId, {
          skuProfileIds,
          whatIf: isRecord(input.whatIf) ? input.whatIf : undefined,
        }, agentToolAuthContext())
        const simulationEntity = { type: 'simulation_run', id: simulationLinkedEntityId(sourceId, result.simulationRunId) }
        const workflowEntity = workflowLinkedEntity(result, simulationEntity)
        return succeeded(result, [{ type: 'simulation', entityId: result.simulationRunId, label: '活动准入模拟重试', summary: `重试来源：${retryOf ?? '未指定'}，SKU ${result.results.length} 个` }], `创建活动准入模拟重试运行：${result.simulationRunId}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [simulationEntity, workflowEntity] : undefined)
      }
      throw new Error('runType must be connector_sync, agent_run, or activity_simulation')
    }

    if (toolName === 'listAgentMissions') {
      const result = finalAgentRuntime.agentService.listMissions({
        page: numberOr(input.page, 1),
        pageSize: numberOr(input.pageSize, 10),
        status: optionalString(input.status),
      })
      return succeeded(result, [{ type: 'tool_trace', entityId: 'agent-missions', label: 'Agent Mission 列表', summary: `读取 ${result.items.length} 个 Mission` }], `读取 Agent Mission：${result.items.length} 个`, result.items[0] ? { type: 'agent_mission', id: result.items[0].missionId } : { type: 'dashboard', id: 'agent-missions' })
    }

    if (toolName === 'getAgentMission') {
      const missionId = String(input.missionId ?? '')
      if (!missionId) throw new Error('missionId is required')
      const result = finalAgentRuntime.agentService.getMission(missionId)
      return succeeded(result, [{ type: 'tool_trace', entityId: missionId, label: 'Agent Mission', summary: `读取 Mission：${result.objective}` }], `读取 Agent Mission：${result.objective}`, { type: 'agent_mission', id: missionId })
    }

    if (toolName === 'createAgentMission') {
      const objective = String(input.objective ?? '')
      if (!objective.trim()) throw new Error('objective is required')
      const result = finalAgentRuntime.agentService.createMission({
        sessionKey: optionalString(input.sessionKey) ?? `agent-chat-${Date.now().toString(36)}`,
        objective,
        missionType: optionalString(input.missionType),
        autonomyLevel: optionalString(input.autonomyLevel),
        sourceSurface: optionalString(input.sourceSurface) ?? 'agent-chat',
        subjectType: optionalString(input.subjectType),
        subjectId: optionalString(input.subjectId),
        constraintsJson: isRecord(input.constraintsJson) ? input.constraintsJson : undefined,
        workbenchContextJson: isRecord(input.workbenchContextJson) ? input.workbenchContextJson : undefined,
        createdBy: optionalString(input.createdBy) ?? 'agent-chat-tool',
      })
      return succeeded(result, [{ type: 'tool_trace', entityId: result.mission.id, label: 'Agent Mission', summary: `创建 Mission：${result.mission.objective}` }], `创建 Agent Mission：${result.mission.id}`, { type: 'agent_mission', id: result.mission.id })
    }

    if (toolName === 'startAgentRun') {
      const missionId = String(input.missionId ?? '')
      if (!missionId) throw new Error('missionId is required')
      const result = finalAgentRuntime.agentService.startRun(missionId, {
        modelProvider: optionalString(input.modelProvider) ?? 'pi',
        modelName: optionalString(input.modelName) ?? 'sku-ready-agent',
        inputJson: isRecord(input.inputJson) ? input.inputJson : undefined,
        timeoutMs: optionalNumber(input.timeoutMs),
      })
      const missionEntity = { type: 'agent_mission', id: missionId }
      const runEntity = { type: 'workflow_run', id: result.id }
      return succeeded(result, [{ type: 'tool_trace', entityId: result.id, label: 'Agent Run', summary: `启动 Agent Run：${result.status}` }], `启动 Agent Run：${result.id}`, runEntity, [missionEntity, runEntity])
    }

    if (toolName === 'getAgentRunDetail') {
      const runId = String(input.runId ?? '')
      if (!runId) throw new Error('runId is required')
      const result = finalAgentRuntime.agentService.getRun(runId)
      const runEntity = { type: 'workflow_run', id: runId }
      const missionEntity = { type: 'agent_mission', id: result.run.missionId }
      return succeeded(result, [{ type: 'tool_trace', entityId: runId, label: 'Agent Run', summary: `读取 Agent Run：${result.run.status}` }], `读取 Agent Run：${result.run.status}`, runEntity, [missionEntity, runEntity])
    }

    if (toolName === 'pauseAgentRun') {
      const runId = String(input.runId ?? '')
      if (!runId) throw new Error('runId is required')
      const result = finalAgentRuntime.agentService.pauseRun(runId, optionalString(input.pausedBy) ?? 'agent-chat-tool')
      const runEntity = { type: 'workflow_run', id: runId }
      const missionEntity = { type: 'agent_mission', id: result.missionId }
      return succeeded(result, [{ type: 'tool_trace', entityId: runId, label: 'Agent Run 暂停', summary: `Run 状态：${result.status}` }], `暂停 Agent Run：${result.status}`, runEntity, [missionEntity, runEntity])
    }

    if (toolName === 'cancelAgentRun') {
      const runId = String(input.runId ?? '')
      if (!runId) throw new Error('runId is required')
      const result = finalAgentRuntime.agentService.cancelRun(runId, optionalString(input.canceledBy) ?? 'agent-chat-tool', optionalString(input.reason))
      const runEntity = { type: 'workflow_run', id: runId }
      const missionEntity = { type: 'agent_mission', id: result.missionId }
      return succeeded(result, [{ type: 'tool_trace', entityId: runId, label: 'Agent Run 取消', summary: `Run 状态：${result.status}` }], `取消 Agent Run：${result.status}`, runEntity, [missionEntity, runEntity])
    }

    if (toolName === 'answerAgentRunQuestion') {
      const runId = String(input.runId ?? '')
      const question = String(input.question ?? '')
      if (!runId || !question.trim()) throw new Error('runId and question are required')
      const result = finalAgentRuntime.agentService.answerQuestion(runId, { question, askedBy: optionalString(input.askedBy) ?? 'agent-chat-tool' })
      const detail = finalAgentRuntime.agentService.getRun(runId)
      const runEntity = { type: 'workflow_run', id: runId }
      const missionEntity = { type: 'agent_mission', id: detail.run.missionId }
      return succeeded(result, [{ type: 'tool_trace', entityId: result.messageId, label: 'Agent Run 问答', summary: result.answer }], `回答 Agent Run 问题：${result.messageId}`, runEntity, [missionEntity, runEntity])
    }

    if (toolName === 'decideAgentReviewGate') {
      const gateId = String(input.gateId ?? '')
      const decision = String(input.decision ?? '')
      if (!gateId || !decision) throw new Error('gateId and decision are required')
      const result = finalAgentRuntime.agentService.decideReviewGate(gateId, {
        decision: decision === 'REJECT' ? 'REJECT' : decision === 'REQUEST_CHANGES' ? 'REQUEST_CHANGES' : 'APPROVE',
        decidedBy: optionalString(input.decidedBy) ?? optionalString(input.decisionBy) ?? 'agent-chat-tool',
        decisionComment: optionalString(input.decisionComment),
      })
      const runEntity = { type: 'workflow_run', id: result.continuationRun.id }
      const missionEntity = { type: 'agent_mission', id: result.continuationRun.missionId }
      return succeeded(result, [{ type: 'review', entityId: gateId, label: 'Agent Review Gate', summary: `Review Gate 决策：${result.gate.status}` }], `处理 Agent Review Gate：${result.gate.status}`, runEntity, [missionEntity, runEntity])
    }

    if (toolName === 'listReports') {
      const result = await finalApiRuntime.reportService.list(agentToolAuthContext())
      return succeeded(result, [{ type: 'report', entityId: 'reports', label: '报告列表', summary: `读取 ${result.items.length} 份报告` }], `读取报告：${result.items.length} 份`, result.items[0] ? { type: 'report', id: result.items[0].reportId } : { type: 'dashboard', id: 'reports' })
    }

    if (toolName === 'getReportDetail') {
      const reportId = String(input.reportId ?? '')
      if (!reportId) throw new Error('reportId is required')
      const result = await finalApiRuntime.reportService.getDetail(reportId, agentToolAuthContext())
      if (!result) throw new Error(`Report not found: ${reportId}`)
      return succeeded(result, result.evidenceSummary.map(reportEvidenceToAgentEvidence), `读取报告详情：${result.title}`, { type: 'report', id: result.reportId })
    }

    if (toolName === 'listReportVersions') {
      const reportId = String(input.reportId ?? '')
      if (!reportId) throw new Error('reportId is required')
      const result = await finalApiRuntime.reportService.listVersions(reportId, agentToolAuthContext())
      return succeeded(result, [{ type: 'report', entityId: reportId, label: '报告版本', summary: `读取 ${result.items.length} 个版本` }], `读取报告版本：${result.items.length} 个`, { type: 'report', id: reportId })
    }

    if (toolName === 'getReportVersion') {
      const reportId = String(input.reportId ?? '')
      const versionId = String(input.versionId ?? '')
      if (!reportId || !versionId) throw new Error('reportId and versionId are required')
      const result = await finalApiRuntime.reportService.getVersion(reportId, versionId, agentToolAuthContext())
      if (!result) throw new Error(`Report version not found: ${reportId}/${versionId}`)
      return succeeded(result, result.evidenceSummary.map(reportEvidenceToAgentEvidence), `读取报告版本：${result.version}`, { type: 'report', id: reportId })
    }

    if (toolName === 'compareReports') {
      const baseReportId = String(input.baseReportId ?? input.reportId ?? '')
      const targetReportId = String(input.targetReportId ?? '')
      if (!baseReportId || !targetReportId) throw new Error('baseReportId and targetReportId are required')
      const result = await finalApiRuntime.reportService.compare(baseReportId, targetReportId, agentToolAuthContext())
      const reportEntity = { type: 'report', id: result.baseReportId }
      const workflowEntity = workflowLinkedEntity(result, reportEntity)
      return succeeded(result, result.evidenceSummary.map(reportEvidenceToAgentEvidence), result.summary, workflowEntity, workflowEntity.type === 'workflow_run' ? [reportEntity, workflowEntity] : undefined)
    }

    if (toolName === 'exportReport') {
      const reportId = String(input.reportId ?? '')
      if (!reportId) throw new Error('reportId is required')
      const request: ReportExportRequestDto = {
        format: input.format === 'EXCEL' || input.format === 'PPT' ? input.format : 'PDF',
        includeCharts: typeof input.includeCharts === 'boolean' ? input.includeCharts : true,
        includeDetails: typeof input.includeDetails === 'boolean' ? input.includeDetails : false,
        idempotencyKey: optionalString(input.idempotencyKey) ?? `agent:${Date.now().toString(36)}`,
      }
      const result = await finalApiRuntime.reportService.export(reportId, request, agentToolAuthContext())
      const linkedEntity = workflowLinkedEntity(result, { type: 'report', id: reportId })
      const reportEntity = { type: 'report', id: reportId }
      return succeeded(result, [{ type: 'report', entityId: reportId, label: '报告导出任务', summary: `导出格式：${result.format}，图表=${result.includeCharts}，明细=${result.includeDetails}` }], `创建报告导出：${result.exportJobId}`, linkedEntity, linkedEntity.type === 'workflow_run' ? [reportEntity, ...(result.artifactHref ? [{ type: 'download_artifact', id: result.artifactHref }] : []), linkedEntity] : undefined)
    }

    if (toolName === 'subscribeReport') {
      const reportId = String(input.reportId ?? '')
      if (!reportId) throw new Error('reportId is required')
      const request: ReportSubscriptionRequestDto = {
        frequency: input.frequency === 'DAILY' || input.frequency === 'MONTHLY' || input.frequency === 'OFF' ? input.frequency : 'WEEKLY',
        recipients: stringArray(input.recipients).length ? stringArray(input.recipients) : ['ops@example.test'],
      }
      const result = await finalApiRuntime.reportService.saveSubscription(reportId, request, agentToolAuthContext())
      const reportEntity = { type: 'report', id: reportId }
      const workflowEntity = workflowLinkedEntity(result, reportEntity)
      return succeeded(result, [{ type: 'report', entityId: reportId, label: '报告订阅', summary: `频率：${result.frequency}，收件人：${result.recipients.join(', ')}` }], `更新报告订阅：${result.frequency}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [reportEntity, workflowEntity] : undefined)
    }

    if (toolName === 'getWorkspaceSettings') {
      const [workspace, policy, users] = await Promise.all([
        finalApiRuntime.workspaceSettingsService.getWorkspace(agentToolAuthContext()),
        finalApiRuntime.workspaceSettingsService.getToolPolicy(agentToolAuthContext()),
        finalApiRuntime.workspaceSettingsService.listUsers(agentToolAuthContext()),
      ])
      const result = { workspace, toolPolicy: policy, users }
      return succeeded(result, [{ type: 'tool_trace', entityId: workspace.workspaceId, label: '工作区设置', summary: `新鲜度阈值 ${workspace.dataFreshnessThresholdHours} 小时，允许工具 ${policy.allowedAgentTools.length} 个` }], `读取工作区设置：${workspace.name}`, { type: 'dashboard', id: 'settings' })
    }

    if (toolName === 'updateWorkspaceSettings') {
      const result = await finalApiRuntime.workspaceSettingsService.updateWorkspace(workspaceSettingsPatchInput(input), agentToolAuthContext())
      const settingsEntity = { type: 'dashboard', id: 'settings' }
      const workflowEntity = workflowLinkedEntity(result, settingsEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.workspaceId, label: '工作区设置更新', summary: `数据新鲜度阈值 ${result.dataFreshnessThresholdHours} 小时` }], `更新工作区设置：${result.dataFreshnessThresholdHours} 小时`, workflowEntity, workflowEntity.type === 'workflow_run' ? [settingsEntity, workflowEntity] : undefined)
    }

    if (toolName === 'getToolPolicy') {
      const result = await finalApiRuntime.workspaceSettingsService.getToolPolicy(agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: result.policyVersion, label: 'Agent 工具策略', summary: `允许 ${result.allowedAgentTools.length} 个工具，禁用 ${result.deniedRuntimeTools.length} 个 runtime 工具` }], `读取 Agent 工具策略：${result.policyVersion}`, { type: 'dashboard', id: 'tool-policy' })
    }

    if (toolName === 'updateToolPolicy') {
      const result = await finalApiRuntime.workspaceSettingsService.updateToolPolicy(toolPolicyPatchInput(input), agentToolAuthContext())
      const settingsEntity = { type: 'dashboard', id: 'tool-policy' }
      const workflowEntity = workflowLinkedEntity(result, settingsEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.policyVersion, label: 'Agent 工具策略更新', summary: `允许 ${result.allowedAgentTools.length} 个工具，禁用 ${result.deniedRuntimeTools.length} 个 runtime 工具` }], `更新 Agent 工具策略：${result.policyVersion}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [settingsEntity, workflowEntity] : undefined)
    }

    if (toolName === 'listSettingsUsers') {
      const result = await finalApiRuntime.workspaceSettingsService.listUsers(agentToolAuthContext())
      return succeeded(result, result.map((item) => ({ type: 'tool_trace', entityId: item.userId, label: item.name, summary: `${item.teamName} / ${item.role} / ${item.status}` })), `读取审批角色：${result.length} 个`, { type: 'dashboard', id: 'settings-users' })
    }

    if (toolName === 'updateSettingsUserStatus') {
      const userId = String(input.userId ?? '')
      if (!userId) throw new Error('userId is required')
      const result = await finalApiRuntime.workspaceSettingsService.updateUserStatus(userId, settingsUserStatusInput(input.status), agentToolAuthContext())
      const settingsEntity = { type: 'dashboard', id: 'settings-users' }
      const workflowEntity = workflowLinkedEntity(result, settingsEntity)
      return succeeded(result, [{ type: 'tool_trace', entityId: result.userId, label: result.name, summary: `${result.teamName} / ${result.role} / ${result.status}` }], `更新审批角色：${result.name} ${result.status}`, workflowEntity, workflowEntity.type === 'workflow_run' ? [settingsEntity, workflowEntity] : undefined)
    }

    throw new Error(`Unsupported tool: ${toolName}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '工具执行失败'
    return { status: 'FAILED', result: { message }, evidence: [], trace: [{ summary: message }] }
  }
}

function agentToolAuthContext() {
  return {
    actorId: 'agent_demo',
    tenantId: 'dev_tenant',
    sessionId: 'agent_demo_session',
    surface: 'agent-chat-tool',
    requestId: `agent_tool_${Date.now().toString(36)}`,
  }
}

function skuListQueryFromToolInput(input: Record<string, unknown>, fallbackPageSize: number): DashboardSkuListQuery {
  return {
    page: numberOr(input.page, 1),
    pageSize: numberOr(input.pageSize, fallbackPageSize),
    q: optionalString(input.q ?? input.query ?? input.keyword),
    skuProfileId: optionalString(input.skuProfileId),
    externalSkuId: optionalString(input.externalSkuId),
    productName: optionalString(input.productName),
    storeId: optionalString(input.storeId),
    platform: optionalString(input.platform),
    platforms: optionalStringArray(input.platforms),
    category: optionalString(input.category),
    categories: optionalStringArray(input.categories),
    healthStatus: optionalString(input.healthStatus) as DashboardSkuListQuery['healthStatus'],
    healthStatuses: optionalStringArray(input.healthStatuses) as DashboardSkuListQuery['healthStatuses'],
    eligibilityStatus: optionalString(input.eligibilityStatus) as DashboardSkuListQuery['eligibilityStatus'],
    eligibilityStatuses: optionalStringArray(input.eligibilityStatuses) as DashboardSkuListQuery['eligibilityStatuses'],
    certificateStatus: optionalString(input.certificateStatus),
    certificateStatuses: optionalStringArray(input.certificateStatuses),
    qualityLabel: optionalString(input.qualityLabel),
    qualityLabels: optionalStringArray(input.qualityLabels),
    sourceKind: optionalString(input.sourceKind),
    sourceKinds: optionalStringArray(input.sourceKinds),
    minSales30d: optionalNumber(input.minSales30d),
    maxSales30d: optionalNumber(input.maxSales30d),
    minPositiveRate: optionalNumber(input.minPositiveRate),
    maxPositiveRate: optionalNumber(input.maxPositiveRate),
    minStock: optionalNumber(input.minStock),
    maxStock: optionalNumber(input.maxStock),
    minQualityScore: optionalNumber(input.minQualityScore),
    maxQualityScore: optionalNumber(input.maxQualityScore),
    collectedAtFrom: optionalString(input.collectedAtFrom),
    collectedAtTo: optionalString(input.collectedAtTo),
    updatedAtFrom: optionalString(input.updatedAtFrom),
    updatedAtTo: optionalString(input.updatedAtTo),
    activityId: optionalString(input.activityId),
    sortBy: optionalString(input.sortBy) as DashboardSkuListQuery['sortBy'],
    sortOrder: optionalString(input.sortOrder) as DashboardSkuListQuery['sortOrder'],
  }
}

async function reportSkuProfileIdsFromInput(input: Record<string, unknown>): Promise<string[]> {
  const explicitIds = stringArray(input.skuProfileIds)
  if (explicitIds.length) return explicitIds
  const requestedMaxSkuCount = optionalNumber(input.maxSkuCount)
  const maxSkuCount = requestedMaxSkuCount && requestedMaxSkuCount > 0 ? Math.floor(requestedMaxSkuCount) : undefined
  const pageSize = Math.min(maxSkuCount ?? 100, 100)
  const query = skuListQueryFromToolInput({
    ...input,
    page: 1,
    pageSize,
    sortBy: optionalString(input.sortBy) ?? 'updatedAt',
    sortOrder: optionalString(input.sortOrder) ?? 'desc',
  }, pageSize)
  const firstPage = await finalApiRuntime.skuReadinessQueryService.list(query, agentToolAuthContext())
  const totalToLoad = maxSkuCount ? Math.min(firstPage.total, maxSkuCount) : firstPage.total
  const totalPages = Math.max(1, Math.ceil(totalToLoad / firstPage.pageSize))
  const restPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => {
    const nextPage = index + 2
    const remaining = totalToLoad - (nextPage - 1) * firstPage.pageSize
    return finalApiRuntime.skuReadinessQueryService.list({ ...query, page: nextPage, pageSize: Math.min(firstPage.pageSize, remaining) }, agentToolAuthContext())
  }))
  return [...firstPage.items, ...restPages.flatMap((page) => page.items)].slice(0, totalToLoad).map((item) => item.skuProfileId)
}

function ingestPayloadInput(input: Record<string, unknown>): IngestPayloadDto {
  const rows = recordArray(input.rows).map((row, index) => ingestRowInput(row, index))
  if (!rows.length) throw new Error('rows are required')
  return {
    connectorId: optionalString(input.connectorId),
    collectedAt: optionalString(input.collectedAt) ?? new Date().toISOString(),
    rows,
  }
}

function ingestRowInput(input: Record<string, unknown>, index: number): IngestRowDto {
  const platform = optionalString(input.platform)
  const storeId = optionalString(input.storeId)
  const externalSkuId = optionalString(input.externalSkuId ?? input.sku ?? input.skuId)
  if (!platform || !storeId || !externalSkuId) throw new Error(`rows[${index}].platform, storeId, and externalSkuId are required`)
  return {
    platform,
    storeId,
    externalSkuId,
    productName: optionalString(input.productName ?? input.title ?? input.name),
    category: optionalString(input.category),
    brand: optionalString(input.brand),
    sourceUrl: optionalString(input.sourceUrl ?? input.url),
    rowIndex: typeof input.rowIndex === 'number' && Number.isInteger(input.rowIndex) ? input.rowIndex : index,
    sales30d: optionalNumber(input.sales30d),
    positiveRate: optionalNumber(input.positiveRate),
    stock: optionalNumber(input.stock),
    originalPrice: optionalNumber(input.originalPrice),
    lowestPrice30d: optionalNumber(input.lowestPrice30d),
    campaignPrice: optionalNumber(input.campaignPrice),
    joinedBrandDay: typeof input.joinedBrandDay === 'boolean' ? input.joinedBrandDay : undefined,
    certificateStatus: optionalString(input.certificateStatus),
    raw: isRecord(input.raw) ? input.raw : input,
  }
}

function browserScanIngestPayload(input: Record<string, unknown>, detectedPlatform?: string): IngestPayloadDto {
  const platform = optionalString(input.platform) ?? detectedPlatform
  const storeId = optionalString(input.storeId)
  const rows = recordArray(input.rows).map((row, index) => browserScanIngestRow(row, index, platform, storeId, optionalString(input.url)))
  if (!rows.length) throw new Error('rows are required')
  return {
    connectorId: optionalString(input.connectorId),
    collectedAt: optionalString(input.collectedAt) ?? new Date().toISOString(),
    rows,
  }
}

function browserScanIngestRow(input: Record<string, unknown>, index: number, defaultPlatform?: string, defaultStoreId?: string, defaultUrl?: string): IngestRowDto {
  const platform = optionalString(input.platform) ?? defaultPlatform
  const storeId = optionalString(input.storeId) ?? defaultStoreId
  const externalSkuId = optionalString(input.externalSkuId ?? input.sku ?? input.skuId ?? input.itemId ?? input.productId)
  if (!platform || !storeId || !externalSkuId) throw new Error(`rows[${index}].platform, storeId, and externalSkuId are required`)
  return {
    platform,
    storeId,
    externalSkuId,
    productName: optionalString(input.productName ?? input.title ?? input.name),
    category: optionalString(input.category),
    brand: optionalString(input.brand),
    sourceUrl: optionalString(input.sourceUrl ?? input.url) ?? defaultUrl,
    rowIndex: typeof input.rowIndex === 'number' && Number.isInteger(input.rowIndex) ? input.rowIndex : index,
    sales30d: optionalNumber(input.sales30d ?? input.sales),
    positiveRate: optionalNumber(input.positiveRate ?? input.rating),
    stock: optionalNumber(input.stock ?? input.inventory),
    originalPrice: optionalNumber(input.originalPrice ?? input.price),
    lowestPrice30d: optionalNumber(input.lowestPrice30d),
    campaignPrice: optionalNumber(input.campaignPrice ?? input.promoPrice),
    joinedBrandDay: typeof input.joinedBrandDay === 'boolean' ? input.joinedBrandDay : undefined,
    certificateStatus: optionalString(input.certificateStatus),
    raw: input,
  }
}

function activityCreateInput(input: Record<string, unknown>): CreateActivityRequestDto {
  const name = optionalString(input.name ?? input.activityName)
  if (!name) throw new Error('name is required')
  return {
    name,
    platform: optionalString(input.platform),
    categoryScope: stringArray(input.categoryScope ?? input.categories),
    productScopeText: optionalString(input.productScopeText ?? input.scope),
    startAt: optionalString(input.startAt),
    endAt: optionalString(input.endAt),
  }
}

function activityUpdateInput(input: Record<string, unknown>): UpdateActivityRequestDto {
  return {
    name: optionalString(input.name ?? input.activityName),
    platform: optionalString(input.platform),
    categoryScope: stringArray(input.categoryScope ?? input.categories),
    productScopeText: optionalString(input.productScopeText ?? input.scope),
    status: normalizeActivityStatus(input.status),
    startAt: nullableString(input.startAt),
    endAt: nullableString(input.endAt),
  }
}

function createRuleSetInput(input: Record<string, unknown>): CreateRuleSetInputDto {
  const name = optionalString(input.name)
  const sourceText = optionalString(input.sourceText)
  if (!name || !sourceText) throw new Error('name and sourceText are required')
  return {
    name,
    sourceText,
    platform: optionalString(input.platform),
    type: input.type === 'ACTIVITY_RULE' ? 'ACTIVITY_RULE' : undefined,
    source: input.source === 'PLATFORM' ? 'PLATFORM' : 'INTERNAL',
    status: normalizeRuleSetStatus(input.status),
  }
}

function updateRuleSetInput(input: Record<string, unknown>): UpdateRuleSetInputDto {
  const patch: UpdateRuleSetInputDto = {}
  const name = optionalString(input.name)
  const sourceText = optionalString(input.sourceText)
  const platform = optionalString(input.platform)
  const status = optionalRuleSetStatus(input.status)
  if (name) patch.name = name
  if (sourceText) patch.sourceText = sourceText
  if (platform) patch.platform = platform
  if (status) patch.status = status
  if (Object.keys(patch).length === 0) throw new Error('name, sourceText, platform, or status is required')
  return patch
}

function reviewPatchInput(input: Record<string, unknown>): Partial<Pick<ReviewItemDto, 'question' | 'recommendation' | 'riskLevel'>> {
  const patch: Partial<Pick<ReviewItemDto, 'question' | 'recommendation' | 'riskLevel'>> = {}
  const question = optionalString(input.question)
  const recommendation = optionalString(input.recommendation ?? input.recommendationText ?? input.content)
  const riskLevel = normalizeReviewRiskLevel(input.riskLevel)
  if (question) patch.question = question
  if (recommendation) patch.recommendation = recommendation
  if (riskLevel) patch.riskLevel = riskLevel
  if (Object.keys(patch).length === 0) throw new Error('question, recommendation, or riskLevel is required')
  return patch
}

async function reviewCreateItemsInput(input: Record<string, unknown>): Promise<Array<Omit<ReviewItemDto, 'reviewItemId' | 'status'>>> {
  const rawItems = recordArray(input.items)
  const itemInputs = rawItems.length ? rawItems : [input]
  const items = await Promise.all(itemInputs.map((item) => reviewCreateItemInput(item)))
  if (!items.length) throw new Error('review items are required')
  return items
}

async function reviewCreateItemInput(input: Record<string, unknown>): Promise<Omit<ReviewItemDto, 'reviewItemId' | 'status'>> {
  const skuProfileId = optionalString(input.skuProfileId)
  const sourceId = optionalString(input.sourceId ?? input.simulationResultId) ?? skuProfileId
  if (!sourceId) throw new Error('skuProfileId or sourceId is required')
  const detail = skuProfileId ? await getRequiredSkuDetail(skuProfileId) : null
  const evidence = reviewEvidenceInput(input.evidence, sourceId, input.question, detail)
  return {
    skuProfileId,
    sourceType: input.sourceType === 'simulation' || input.sourceType === 'health' ? input.sourceType : 'agent',
    sourceId,
    question: String(input.question ?? (detail ? `确认 ${detail.productName} 的下一步处理` : '确认 Agent 建议的业务动作')),
    recommendation: optionalString(input.recommendation) ?? detail?.nextActions.join('；') ?? undefined,
    riskLevel: input.riskLevel === 'L2' || input.riskLevel === 'L0' ? input.riskLevel : 'L1',
    evidence,
  }
}

function reviewEvidenceInput(value: unknown, sourceId: string, question: unknown, detail: SkuDetailDto | null): EvidenceLinkDto[] {
  const evidence = recordArray(value).flatMap((item) => {
    const type = item.type
    const entityId = optionalString(item.entityId ?? item.sourceId)
    if (!entityId || !isEvidenceLinkType(type)) return []
    return [{
      type,
      entityId,
      label: optionalString(item.label) ?? 'Agent Review Evidence',
      summary: optionalString(item.summary ?? item.evidenceText) ?? String(question ?? 'Agent 创建人工确认项'),
    }]
  })
  if (evidence.length) return evidence
  if (detail?.evidence.length) return detail.evidence
  return [{ type: 'tool_trace', entityId: sourceId, label: 'Agent Review', summary: String(question ?? 'Agent 创建人工确认项') }]
}

function isEvidenceLinkType(value: unknown): value is EvidenceLinkDto['type'] {
  return value === 'snapshot' || value === 'diagnosis' || value === 'rule' || value === 'simulation' || value === 'review' || value === 'report' || value === 'tool_trace'
}

function createConnectorInput(input: Record<string, unknown>): CreateConnectorDto {
  const name = optionalString(input.name)
  if (!name) throw new Error('name is required')
  return {
    code: optionalString(input.code) ?? `agent_${Date.now().toString(36)}`,
    name,
    kind: optionalString(input.connectorKind ?? input.kind) ?? 'platform_api',
    platform: optionalString(input.platform),
    status: normalizeConnectorStatus(input.status),
    config: isRecord(input.config) ? input.config : { createdFrom: 'agent-chat-tool' },
  }
}

function updateConnectorInput(input: Record<string, unknown>): UpdateConnectorDto {
  const patch: UpdateConnectorDto = {}
  const name = optionalString(input.name)
  const platform = nullableString(input.platform)
  const status = normalizeConnectorStatus(input.status)
  if (name) patch.name = name
  if (platform !== undefined) patch.platform = platform
  if (status) patch.status = status
  if (isRecord(input.config)) patch.config = input.config
  if (Object.keys(patch).length === 0) throw new Error('name, platform, status, or config is required')
  return patch
}

function workspaceSettingsPatchInput(input: Record<string, unknown>): Partial<WorkspaceSettingsDto> {
  const patch: Partial<WorkspaceSettingsDto> = {}
  const freshness = optionalNumber(input.dataFreshnessThresholdHours ?? input.freshnessHours)
  if (freshness !== undefined) patch.dataFreshnessThresholdHours = freshness
  if (isRecord(input.reviewSlaHours)) {
    const current = input.reviewSlaHours
    patch.reviewSlaHours = {
      high: optionalNumber(current.high) ?? 4,
      medium: optionalNumber(current.medium) ?? 24,
      low: optionalNumber(current.low) ?? 72,
    }
  }
  if (stringArray(input.allowedAgentTools).length) patch.allowedAgentTools = stringArray(input.allowedAgentTools)
  if (stringArray(input.deniedRuntimeTools).length) patch.deniedRuntimeTools = stringArray(input.deniedRuntimeTools)
  if (Object.keys(patch).length === 0) throw new Error('dataFreshnessThresholdHours, reviewSlaHours, allowedAgentTools, or deniedRuntimeTools is required')
  return patch
}

function toolPolicyPatchInput(input: Record<string, unknown>): Partial<ToolPolicyDto> {
  const patch: Partial<ToolPolicyDto> = {}
  if (Array.isArray(input.allowedAgentTools)) patch.allowedAgentTools = stringArray(input.allowedAgentTools)
  if (Array.isArray(input.deniedRuntimeTools)) patch.deniedRuntimeTools = stringArray(input.deniedRuntimeTools)
  if (Object.keys(patch).length === 0) throw new Error('allowedAgentTools or deniedRuntimeTools is required')
  return patch
}

function settingsUserStatusInput(value: unknown): SettingsUserDto['status'] {
  if (value === 'ACTIVE' || value === 'DISABLED') return value
  throw new Error('status must be ACTIVE or DISABLED')
}

function browserPageDetectionInput(input: Record<string, unknown>): BrowserPageDetectionRequestDto {
  const url = optionalString(input.url)
  if (!url) throw new Error('url is required')
  return {
    url,
    title: optionalString(input.title),
    htmlTextSample: optionalString(input.htmlTextSample ?? input.sample),
  }
}

function browserScanPreviewInput(input: Record<string, unknown>): BrowserScanPreviewRequestDto {
  const url = optionalString(input.url)
  if (!url) throw new Error('url is required')
  const rows = recordArray(input.rows)
  if (!rows.length) throw new Error('rows are required')
  return {
    connectorId: optionalString(input.connectorId),
    url,
    collectedAt: optionalString(input.collectedAt),
    rows,
  }
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function normalizeReviewRiskLevel(value: unknown): ReviewItemDto['riskLevel'] | undefined {
  if (value === 'L0' || value === 'L1' || value === 'L2') return value
  return undefined
}

function normalizeConnectorStatus(value: unknown): CreateConnectorDto['status'] | undefined {
  if (value === 'ACTIVE' || value === 'INACTIVE' || value === 'NEEDS_AUTH' || value === 'FAILED' || value === 'DISABLED') return value
  return undefined
}

function normalizeActivityStatus(value: unknown): UpdateActivityRequestDto['status'] {
  if (value === 'DRAFT' || value === 'RUNNING' || value === 'COMPLETED' || value === 'FAILED') return value
  return undefined
}

function toSkuCandidate(item: {
  skuProfileId: string
  displaySku: string
  productName: string
  category?: string
  sales30d?: number
  positiveRate?: number
  qualityScore?: number
  qualityLabel?: string
  sourceKind?: string
  stock?: number
  healthStatus: string
  eligibilityStatus?: string
  eligibilityLabel: string
  nextAction: { type: string; label: string; disabled?: boolean }
  evidenceCount: number
  updatedAt: string
}) {
  return {
    skuProfileId: item.skuProfileId,
    displaySku: item.displaySku,
    productName: item.productName,
    category: item.category,
    metrics: {
      sales30d: item.sales30d,
      positiveRate: item.positiveRate,
      qualityScore: item.qualityScore,
      qualityLabel: item.qualityLabel,
      sourceKind: item.sourceKind,
      stock: item.stock,
    },
    healthStatus: item.healthStatus,
    eligibilityStatus: item.eligibilityStatus,
    eligibilityLabel: item.eligibilityLabel,
    nextAction: item.nextAction,
    evidenceCount: item.evidenceCount,
    updatedAt: item.updatedAt,
  }
}

function toSkuSummaryCandidate(item: SkuSummaryDto) {
  return {
    skuProfileId: item.skuProfileId,
    displaySku: item.canonicalSkuKey,
    productName: item.productName,
    category: undefined,
    metrics: {
      healthScore: 'healthScore' in item ? item.healthScore : undefined,
      dataQualityScore: 'dataQualityScore' in item ? item.dataQualityScore : undefined,
    },
    healthStatus: item.healthStatus,
    eligibilityStatus: undefined,
    eligibilityLabel: item.healthStatus,
    nextAction: {
      type: item.healthStatus === 'READY' ? 'VIEW_DETAIL' : 'REPAIR_ISSUE',
      label: item.nextActions?.[0] ?? (item.healthStatus === 'READY' ? '查看详情' : '查看风险'),
    },
    topIssues: item.topIssues ?? [],
    evidenceCount: 0,
    updatedAt: new Date().toISOString(),
  }
}

function dashboardEvidence(result: { skuCandidates: Array<{ skuProfileId: string; productName: string; healthStatus: string }>; healthSummary: unknown }): EvidenceLinkDto[] {
  return [
    { type: 'tool_trace', entityId: 'dashboard-health-summary', label: 'Dashboard 健康汇总', summary: summarizeToolOutput(result.healthSummary, '已读取健康汇总') },
    ...skuListEvidence(result.skuCandidates).slice(0, 5),
  ]
}

function skuListEvidence(items: Array<{ skuProfileId: string; productName: string; healthStatus: string }>): EvidenceLinkDto[] {
  return items.map((item) => ({
    type: 'tool_trace',
    entityId: item.skuProfileId,
    label: item.productName,
    summary: `SKU ${item.skuProfileId} 当前健康状态 ${item.healthStatus}`,
  }))
}

async function getRequiredSkuDetail(skuProfileId: string): Promise<SkuDetailDto> {
  if (!skuProfileId) throw new Error('skuProfileId is required')
  const detail = await finalApiRuntime.ingestService.getSkuDetail(skuProfileId, agentToolAuthContext())
  if (!detail) throw new Error(`SKU not found: ${skuProfileId}`)
  return detail
}

function succeeded(result: unknown, evidence: EvidenceLinkDto[], summary: string, linkedEntity?: { type: string; id: string }, linkedEntities?: Array<{ type: string; id: string }>): FinalApiToolExecution {
  return { status: 'SUCCEEDED', result, evidence, linkedEntity, linkedEntities, trace: [{ summary }] }
}

function workflowLinkedEntity(value: unknown, fallback: { type: string; id: string }): { type: string; id: string } {
  const workflowRunId = isRecord(value) && typeof value.workflowRunId === 'string' && value.workflowRunId.trim() ? value.workflowRunId.trim() : ''
  return workflowRunId ? { type: 'workflow_run', id: workflowRunId } : fallback
}

function connectorRunWorkflowEntity(value: unknown, fallback: { type: string; id: string }): { type: string; id: string } {
  if (!isRecord(value)) return fallback
  const workflowRunRef = isRecord(value.workflowRunRef) ? value.workflowRunRef : null
  const workflowRunId = typeof workflowRunRef?.entityId === 'string' && workflowRunRef.entityId.trim() ? workflowRunRef.entityId.trim() : ''
  return workflowRunId ? { type: 'workflow_run', id: workflowRunId } : fallback
}

function activityWorkflowEntity(value: unknown, fallback: { type: string; id: string }): { type: string; id: string } {
  if (!isRecord(value)) return fallback
  const latestRunId = typeof value.latestRunId === 'string' && value.latestRunId.trim() ? value.latestRunId.trim() : ''
  return latestRunId.startsWith('workflow') ? { type: 'workflow_run', id: latestRunId } : fallback
}

function latestReviewWorkflow(detail: unknown): { workflowRunId?: string } {
  if (!isRecord(detail) || !Array.isArray(detail.approvalHistory)) return {}
  const latest = [...detail.approvalHistory].reverse().find((item) => isRecord(item) && typeof item.workflowRunId === 'string') as Record<string, unknown> | undefined
  return typeof latest?.workflowRunId === 'string' ? { workflowRunId: latest.workflowRunId } : {}
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
}

function optionalStringArray(value: unknown): string[] | undefined {
  const items = stringArray(value)
  return items.length ? items : undefined
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return optionalString(value)
}

function normalizeNextAction(input: Record<string, unknown>): DashboardSkuListItemDto['nextAction'] {
  const nested = isRecord(input.nextAction) ? input.nextAction : input
  const type = typeof nested.type === 'string' ? nested.type : 'VIEW_DETAIL'
  const label = optionalString(nested.label) ?? optionalString(input.label) ?? '查看详情'
  if (type === 'JOIN_ACTIVITY' || type === 'REPAIR_ISSUE' || type === 'VIEW_DETAIL' || type === 'VIEW_BLOCKER' || type === 'MANUAL_REVIEW') {
    return { type, label, disabled: typeof nested.disabled === 'boolean' ? nested.disabled : undefined }
  }
  return { type: 'VIEW_DETAIL' as const, label, disabled: typeof nested.disabled === 'boolean' ? nested.disabled : undefined }
}

function normalizeRuleSetStatus(value: unknown): RuleSetStatusDto {
  if (value === 'DRAFT' || value === 'DISABLED') return value
  return 'ENABLED'
}

function optionalRuleSetStatus(value: unknown): RuleSetStatusDto | undefined {
  if (value === 'DRAFT' || value === 'DISABLED' || value === 'ENABLED') return value
  return undefined
}

function normalizeRuleSetListStatus(value: unknown): RuleSetStatusDto | 'ALL' | undefined {
  if (value === 'ALL') return 'ALL'
  return optionalRuleSetStatus(value)
}

function normalizeReviewDecision(value: unknown): ReviewDecisionRequestDto['decision'] {
  if (value === 'REJECT' || value === 'REQUEST_CHANGES') return value
  return 'APPROVE'
}

function reviewEvidenceToAgentEvidence(ref: { entityId: string; label: string; evidenceText?: string; field?: string; sourceId: string }): EvidenceLinkDto {
  return {
    type: 'review',
    entityId: ref.entityId,
    label: ref.label,
    summary: ref.evidenceText ?? ref.field ?? ref.sourceId,
  }
}

function reportEvidenceToAgentEvidence(ref: { entityId: string; label: string; evidenceText?: string; field?: string; sourceId: string }): EvidenceLinkDto {
  return {
    type: 'report',
    entityId: ref.entityId,
    label: ref.label,
    summary: ref.evidenceText ?? ref.field ?? ref.sourceId,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
    href: linkedEntityHref(entity.entityType, entity.entityId),
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
  const entityType = normalizeLinkedEntityType(entity.type)
  return {
    id: `${toolName}-entity-${entity.id}`,
    entityType,
    entityId: entity.id,
    label: linkedEntityLabel(entityType, entity.id),
    reason: `由 ${toolName} 工具返回`,
    sourceType: 'tool_call',
    sourceId: toolName,
  }
}

function normalizeLinkedEntityType(type: string): AgentLinkedEntity['entityType'] {
  if (type === 'activity_rule_set') return 'rule_set'
  if (type === 'dashboard') return 'dashboard'
  if (type === 'report') return 'report'
  if (type === 'sku_profile' || type === 'activity' || type === 'rule_set' || type === 'simulation_run' || type === 'review_item' || type === 'workflow_run' || type === 'connector' || type === 'agent_mission' || type === 'download_artifact') return type
  return 'dashboard'
}

function linkedEntityLabel(entityType: string, entityId: string): string {
  if (entityType === 'sku_profile') return 'SKU 证据'
  if (entityType === 'rule_set') return '规则库'
  if (entityType === 'simulation_run') return '规则执行'
  if (entityType === 'review_item') return 'Review 工作台'
  if (entityType === 'report') return '报告中心'
  if (entityType === 'workflow_run') return 'Run Console'
  if (entityType === 'connector') return '数据源'
  if (entityType === 'agent_mission') return 'Agent Mission'
  if (entityType === 'download_artifact') return '下载产物'
  if (entityId === 'connectors') return '数据源'
  if (entityId === 'reports') return '报告中心'
  if (entityId === 'reviews') return 'Review 工作台'
  if (entityId === 'rule-sets') return '规则库'
  return '工作台'
}

export function linkedEntityHref(entityType: string, entityId: string): string {
  if (entityType === 'sku_profile') return `/sku-access?${new URLSearchParams({ skuProfileId: entityId, drawerTab: 'evidence' }).toString()}`
  if (entityType === 'activity') return `/rule-execution?${new URLSearchParams({ activityId: entityId }).toString()}`
  if (entityType === 'rule_set' || entityType === 'activity_rule_set') return `/rule-library?${new URLSearchParams({ ruleSetId: entityId }).toString()}`
  if (entityType === 'simulation_run') {
    const parsed = parseSimulationLinkedEntityId(entityId)
    const params = new URLSearchParams({ simulationRunId: parsed.simulationRunId })
    if (parsed.ruleSetId) params.set('ruleSetId', parsed.ruleSetId)
    return `/rule-execution?${params.toString()}`
  }
  if (entityType === 'review_item') return `/review-approvals?${new URLSearchParams({ reviewItemId: entityId }).toString()}`
  if (entityType === 'report') return `/report-center?${new URLSearchParams({ reportId: entityId }).toString()}`
  if (entityType === 'workflow_run') return `/run-console?${new URLSearchParams({ runId: entityId }).toString()}`
  if (entityType === 'connector') return `/data-sources?${new URLSearchParams({ connectorId: entityId }).toString()}`
  if (entityType === 'agent_mission') return `/agent-mission?${new URLSearchParams({ missionId: entityId }).toString()}`
  if (entityType === 'download_artifact') return entityId.startsWith('/api/') ? entityId : '/overview'
  if (entityId === 'connectors' || entityId === 'browser-scan-ingest') return '/data-sources'
  if (entityId === 'reports') return '/report-center'
  if (entityId === 'reviews') return '/review-approvals'
  if (entityId === 'rule-sets') return '/rule-library'
  if (entityId === 'run-console') return '/run-console'
  if (entityId === 'agent-missions') return '/agent-mission'
  if (entityId === 'settings' || entityId === 'tool-policy' || entityId === 'settings-users') return '/settings'
  return '/overview'
}

function simulationLinkedEntityId(ruleSetId: string, simulationRunId: string): string {
  return `${encodeURIComponent(ruleSetId)}:${encodeURIComponent(simulationRunId)}`
}

function parseSimulationLinkedEntityId(value: string): { ruleSetId?: string; simulationRunId: string } {
  const separatorIndex = value.indexOf(':')
  if (separatorIndex <= 0) return { simulationRunId: value }
  const ruleSetId = decodeURIComponent(value.slice(0, separatorIndex))
  const simulationRunId = decodeURIComponent(value.slice(separatorIndex + 1))
  return { ruleSetId, simulationRunId }
}

function summarizeToolOutput(value: unknown, fallback = '工具已执行'): string {
  if (typeof value === 'string') return value.slice(0, 240)
  if (!value || typeof value !== 'object') return fallback
  if ('productName' in value) return `SKU ${String((value as { productName?: unknown }).productName)} 摘要已读取`
  if ('healthStatus' in value) return `健康状态：${String((value as { healthStatus?: unknown }).healthStatus)}`
  if ('isFresh' in value) return `数据新鲜度：${(value as { isFresh?: unknown }).isFresh ? 'fresh' : 'stale'}`
  if ('freshnessStatus' in value) return `数据新鲜度：${String((value as { freshnessStatus?: unknown }).freshnessStatus)}`
  if ('title' in value) return String((value as { title?: unknown }).title)
  return JSON.stringify(value).slice(0, 240)
}

function containsSensitive(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitive)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) => sensitiveKeyPattern.test(key) || containsSensitive(child))
}

function normalizePolicyToolName(toolName: string): string {
  if (toolName === 'reportPreview' || toolName === 'generateReportPreview') return 'generateReport'
  if (toolName === 'runSimulation') return 'simulateActivityReadiness'
  return toolName
}

function normalizeExecutableToolName(toolName: string): string {
  if (toolName === 'reportPreview' || toolName === 'generateReportPreview') return 'generateReport'
  if (toolName === 'runSimulation') return 'simulateActivityReadiness'
  return toolName
}

function scrubSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSensitive)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sensitiveKeyPattern.test(key) ? '[REDACTED]' : scrubSensitive(child)]))
}
