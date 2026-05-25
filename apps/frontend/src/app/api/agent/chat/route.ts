import { fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { REAL_AGENT_CHAT_NOT_CONFIGURED, RealAgentChatConfigurationError, RealAgentChatRuntime, type AgentConversationEvidenceRef, type AgentConversationLinkedEntity, type AgentConversationRepository, type AgentConversationToolExecution } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import type { CreateConnectorSyncRunDto } from '../../../../../../contracts/types/connectorBackend'
import type { EvidenceLinkDto, ReviewItemDto, SkuDetailDto, SkuSummaryDto } from '../../../../../../contracts/types/businessFoundation'
import type { ReportExportRequestDto, ReportSubscriptionRequestDto } from '../../../../../../contracts/types/reviewReportCenter'
import type { DashboardSkuListItemDto, DashboardSkuListQuery } from '../../../../../../contracts/types/dashboardSkuReadModels'
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

const registeredAgentTools = new Set(['getDashboardContext', 'searchSkus', 'listRuleSets', 'listActivities', 'getSkuSummary', 'parseActivityRules', 'checkDataFreshness', 'diagnoseSkuHealth', 'simulateActivityReadiness', 'explainDecisionWithEvidence', 'generateReport', 'generateReportPreview', 'createReviewItems', 'setSkuNextAction', 'listConnectors', 'runConnectorSync', 'listReports', 'exportReport', 'subscribeReport'])
const writeAgentTools = new Set(['createReviewItems', 'setSkuNextAction', 'runConnectorSync', 'exportReport', 'subscribeReport'])
const sensitiveKeyPattern = /cookie|token|jwt|sso|secret|api[_-]?key|authorization|password|credential/i

function createPersistentToolExecutor(repository: AgentConversationRepository) {
  return async (input: {
    run: { id: string }
    mission: { id: string }
    toolName: string
    inputJson: Record<string, unknown>
    externalToolCallId?: string | null
  }): Promise<AgentConversationToolExecution> => {
    const toolName = input.toolName === 'reportPreview' ? 'generateReport' : input.toolName === 'generateReportPreview' ? 'generateReport' : input.toolName
    const safeInput = scrubSensitive(input.inputJson) as Record<string, unknown>
    if (!registeredAgentTools.has(toolName) || containsSensitive(input.inputJson)) {
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

    const execution = await executeFinalApiTool(toolName, safeInput)
    const status = execution.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED'
    const evidenceRefs = execution.evidence.map((item, index) => toConversationEvidence(toolName, item, index))
    const linkedEntities = execution.linkedEntity ? [toConversationLinkedEntity(toolName, execution.linkedEntity)] : []
    const summary = summarizeToolOutput(execution.result, execution.trace.map((item) => item.summary).join('；'))
    const toolCall = await repository.createToolCall({
      runId: input.run.id,
      externalToolCallId: input.externalToolCallId ?? null,
      toolName,
      status,
      riskLevel: writeAgentTools.has(toolName) ? 'L2' : 'L1',
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

interface FinalApiToolExecution {
  status: 'SUCCEEDED' | 'FAILED'
  result: unknown
  evidence: EvidenceLinkDto[]
  linkedEntity?: { type: string; id: string }
  trace: Array<{ summary: string }>
}

async function executeFinalApiTool(toolName: string, input: Record<string, unknown>): Promise<FinalApiToolExecution> {
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

    if (toolName === 'listRuleSets') {
      const result = await finalApiRuntime.ruleSetService.list(numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext())
      return succeeded(result, [{ type: 'rule', entityId: 'rule-sets', label: '规则集列表', summary: `读取 ${result.items.length} 个规则集` }], `读取规则集：${result.items.length} 个`, result.items[0] ? { type: 'rule_set', id: result.items[0].ruleSetId } : { type: 'dashboard', id: 'rule-sets' })
    }

    if (toolName === 'listActivities') {
      const result = await finalApiRuntime.activityService.list(numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: 'activities', label: '活动列表', summary: `读取 ${result.items.length} 个活动` }], `读取活动：${result.items.length} 个`, result.items[0] ? { type: 'activity', id: result.items[0].activityId } : { type: 'dashboard', id: 'activities' })
    }

    if (toolName === 'getSkuSummary') {
      const detail = await getRequiredSkuDetail(String(input.skuProfileId ?? ''))
      return succeeded(detail, detail.evidence, `读取 SKU：${detail.productName}`, { type: 'sku_profile', id: detail.skuProfileId })
    }

    if (toolName === 'checkDataFreshness') {
      const detail = await getRequiredSkuDetail(String(input.skuProfileId ?? ''))
      const maxAgeHours = numberOr(input.maxAgeHours, 24)
      const collectedAt = detail.latestSnapshot?.collectedAt ?? null
      const ageHours = collectedAt ? Math.max(0, Math.round(((Date.now() - new Date(collectedAt).getTime()) / 36_000) / 10)) : null
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
      })
      return succeeded(result, result.errors.length ? [] : [{ type: 'rule', entityId: result.ruleSetId, label: result.name, summary: `规则解析状态：${result.parseStatus}` }], `解析规则：${result.parseStatus}`, { type: 'rule_set', id: result.ruleSetId })
    }

    if (toolName === 'simulateActivityReadiness') {
      const ruleSetId = String(input.ruleSetId ?? input.activityRuleSetId ?? '')
      const skuProfileIds = stringArray(input.skuProfileIds)
      if (!ruleSetId || skuProfileIds.length === 0) throw new Error('ruleSetId and skuProfileIds are required')
      const result = await finalApiRuntime.activityService.simulate(ruleSetId, {
        skuProfileIds,
        whatIf: isRecord(input.whatIf) ? input.whatIf : undefined,
      })
      const evidence = result.results.flatMap((item) => item.evidence)
      return succeeded(result, evidence, `模拟完成：${result.results.length} 个 SKU`, { type: 'simulation_run', id: result.simulationRunId })
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
      const skuProfileIds = stringArray(input.skuProfileIds)
      if (skuProfileIds.length === 0) throw new Error('skuProfileIds are required')
      const result = await finalApiRuntime.reportService.generate({
        type: input.type === 'HEALTH' ? 'HEALTH' : 'ACTIVITY',
        skuProfileIds,
        simulationResultIds: stringArray(input.simulationResultIds),
      })
      return succeeded(result, result.evidenceSummary, `生成报告：${result.title}`, { type: 'report', id: result.reportId })
    }

    if (toolName === 'createReviewItems') {
      const skuProfileId = String(input.skuProfileId ?? '')
      const sourceId = String(input.sourceId ?? skuProfileId)
      if (!sourceId) throw new Error('skuProfileId or sourceId is required')
      const detail = skuProfileId ? await getRequiredSkuDetail(skuProfileId) : null
      const evidence: EvidenceLinkDto[] = detail?.evidence.length ? detail.evidence : [{ type: 'tool_trace', entityId: sourceId, label: 'Agent Review', summary: String(input.question ?? 'Agent 创建人工确认项') }]
      const item: Omit<ReviewItemDto, 'reviewItemId' | 'status'> = {
        skuProfileId: skuProfileId || undefined,
        sourceType: input.sourceType === 'simulation' || input.sourceType === 'health' ? input.sourceType : 'agent',
        sourceId,
        question: String(input.question ?? (detail ? `确认 ${detail.productName} 的下一步处理` : '确认 Agent 建议的业务动作')),
        recommendation: optionalString(input.recommendation) ?? detail?.nextActions.join('；') ?? undefined,
        riskLevel: input.riskLevel === 'L2' || input.riskLevel === 'L0' ? input.riskLevel : 'L1',
        evidence,
      }
      const result = await finalApiRuntime.reviewService.create([item], agentToolAuthContext())
      return succeeded(result, result.flatMap((created) => created.evidence), `创建 Review：${result.map((created) => created.reviewItemId).join(', ')}`, result[0] ? { type: 'review_item', id: result[0].reviewItemId } : undefined)
    }

    if (toolName === 'setSkuNextAction') {
      const skuProfileId = String(input.skuProfileId ?? '')
      if (!skuProfileId) throw new Error('skuProfileId is required')
      const nextAction = normalizeNextAction(input)
      const result = await finalApiRuntime.skuReadinessQueryService.updateNextAction(skuProfileId, { nextAction, comment: optionalString(input.comment) ?? 'agent-chat-tool' }, agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: skuProfileId, label: 'SKU 下一步设置', summary: `下一步已设置为：${result.statusSummary.nextStep}` }], `设置 SKU 下一步：${result.statusSummary.nextStep}`, { type: 'sku_profile', id: skuProfileId })
    }

    if (toolName === 'listConnectors') {
      const result = await finalApiRuntime.connectorService.list(numberOr(input.page, 1), numberOr(input.pageSize, 10), agentToolAuthContext())
      return succeeded(result, [{ type: 'tool_trace', entityId: 'connectors', label: '连接器列表', summary: `读取 ${result.items.length} 个连接器` }], `读取连接器：${result.items.length} 个`, result.items[0] ? { type: 'connector', id: result.items[0].connectorId } : { type: 'dashboard', id: 'connectors' })
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
      return succeeded(result, [{ type: 'tool_trace', entityId: result.connectorRunId, label: '连接器采集运行', summary: `状态：${result.status}，行数：${result.rowCount}` }], `创建连接器采集运行：${result.connectorRunId}`, { type: 'connector', id: connectorId })
    }

    if (toolName === 'listReports') {
      const result = await finalApiRuntime.reportService.list(agentToolAuthContext())
      return succeeded(result, [{ type: 'report', entityId: 'reports', label: '报告列表', summary: `读取 ${result.items.length} 份报告` }], `读取报告：${result.items.length} 份`, result.items[0] ? { type: 'report', id: result.items[0].reportId } : { type: 'dashboard', id: 'reports' })
    }

    if (toolName === 'exportReport') {
      const reportId = String(input.reportId ?? '')
      if (!reportId) throw new Error('reportId is required')
      const request: ReportExportRequestDto = {
        format: input.format === 'EXCEL' || input.format === 'PPT' ? input.format : 'PDF',
        idempotencyKey: optionalString(input.idempotencyKey) ?? `agent:${Date.now().toString(36)}`,
      }
      const result = await finalApiRuntime.reportService.export(reportId, request, agentToolAuthContext())
      return succeeded(result, [{ type: 'report', entityId: reportId, label: '报告导出任务', summary: `导出格式：${result.format}，状态：${result.status}` }], `创建报告导出：${result.exportJobId}`, { type: 'report', id: reportId })
    }

    if (toolName === 'subscribeReport') {
      const reportId = String(input.reportId ?? '')
      if (!reportId) throw new Error('reportId is required')
      const request: ReportSubscriptionRequestDto = {
        frequency: input.frequency === 'DAILY' || input.frequency === 'MONTHLY' || input.frequency === 'OFF' ? input.frequency : 'WEEKLY',
        recipients: stringArray(input.recipients).length ? stringArray(input.recipients) : ['ops@example.test'],
      }
      const result = await finalApiRuntime.reportService.saveSubscription(reportId, request, agentToolAuthContext())
      return succeeded(result, [{ type: 'report', entityId: reportId, label: '报告订阅', summary: `频率：${result.frequency}，收件人：${result.recipients.join(', ')}` }], `更新报告订阅：${result.frequency}`, { type: 'report', id: reportId })
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
    category: optionalString(input.category),
    healthStatus: optionalString(input.healthStatus) as DashboardSkuListQuery['healthStatus'],
    eligibilityStatus: optionalString(input.eligibilityStatus) as DashboardSkuListQuery['eligibilityStatus'],
    certificateStatus: optionalString(input.certificateStatus),
    qualityLabel: optionalString(input.qualityLabel),
    sourceKind: optionalString(input.sourceKind),
    minSales30d: optionalNumber(input.minSales30d),
    maxSales30d: optionalNumber(input.maxSales30d),
    minPositiveRate: optionalNumber(input.minPositiveRate),
    maxPositiveRate: optionalNumber(input.maxPositiveRate),
    minStock: optionalNumber(input.minStock),
    maxStock: optionalNumber(input.maxStock),
    minQualityScore: optionalNumber(input.minQualityScore),
    maxQualityScore: optionalNumber(input.maxQualityScore),
    activityId: optionalString(input.activityId),
    sortBy: optionalString(input.sortBy) as DashboardSkuListQuery['sortBy'],
    sortOrder: optionalString(input.sortOrder) as DashboardSkuListQuery['sortOrder'],
  }
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
  const detail = await finalApiRuntime.ingestService.getSkuDetail(skuProfileId)
  if (!detail) throw new Error(`SKU not found: ${skuProfileId}`)
  return detail
}

function succeeded(result: unknown, evidence: EvidenceLinkDto[], summary: string, linkedEntity?: { type: string; id: string }): FinalApiToolExecution {
  return { status: 'SUCCEEDED', result, evidence, linkedEntity, trace: [{ summary }] }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
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

function normalizeNextAction(input: Record<string, unknown>): DashboardSkuListItemDto['nextAction'] {
  const nested = isRecord(input.nextAction) ? input.nextAction : input
  const type = typeof nested.type === 'string' ? nested.type : 'VIEW_DETAIL'
  const label = optionalString(nested.label) ?? optionalString(input.label) ?? '查看详情'
  if (type === 'JOIN_ACTIVITY' || type === 'REPAIR_ISSUE' || type === 'VIEW_DETAIL' || type === 'VIEW_BLOCKER' || type === 'MANUAL_REVIEW') {
    return { type, label, disabled: typeof nested.disabled === 'boolean' ? nested.disabled : undefined }
  }
  return { type: 'VIEW_DETAIL' as const, label, disabled: typeof nested.disabled === 'boolean' ? nested.disabled : undefined }
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
    entityType: entity.type === 'report' ? 'workflow_run' : entity.type === 'dashboard' ? 'workflow_run' : entity.type,
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

function scrubSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSensitive)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sensitiveKeyPattern.test(key) ? '[REDACTED]' : scrubSensitive(child)]))
}
