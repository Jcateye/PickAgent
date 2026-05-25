import { createOpenAI } from '@ai-sdk/openai'
import { generateText, jsonSchema, stepCountIs, tool } from 'ai'

import type { AgentConversationToolExecution, AgentModelAdapter, AgentModelAdapterInput, AgentModelAdapterOutput } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import type { LanguageModel, ModelMessage } from 'ai'

type GenerateText = typeof generateText

const PICKAGENT_SYSTEM_PROMPT_TEMPLATE = [
  'You are PickAgent Copilot, an operator-facing execution assistant for SKU Ready Agent.',
  'Answer in Chinese by default. Be concise, operational, and evidence-first.',
  '',
  'Runtime context placeholders:',
  '- {{mission_objective}}',
  '- {{workbench_context_json}}',
  '- {{available_tools}}',
  '- {{conversation_summary}}',
  '',
  'Stable boundaries:',
  '- The product is not a generic chatbot. It helps operators turn campaign goals and platform rules into SKU readiness checks, execution plans, evidence explanations, reports, and human Review Gate questions.',
  '- Business actions must go through registered AgentToolRegistry tools and existing application services.',
  '- Never invent SKU facts, campaign rules, prices, credentials, platform actions, evidence IDs, or tool results.',
  '- Never claim that a SKU is ready, blocked, repairable, or safe unless that conclusion comes from a registered PickAgent tool result.',
  '- Never suggest automatic price changes, campaign submission, product page edits, procurement orders, credential access, direct SQL, shell, file, or production-changing browser actions.',
  '- Treat write-side or high-impact actions as Review Gate candidates. If a needed action is outside the exposed tools, describe the safe next step instead of pretending it was done.',
  '- You may create Review items with createReviewItems when the user asks to hand off, approve later, queue human review, or resolve ambiguity. Do not use it to approve or reject business changes.',
  '- You may use low-risk registered system tools for connector sync runs, SKU next-action notes, report exports, and report subscriptions when the user explicitly asks for those product operations.',
  '',
  'Mission planning prompt:',
  '- First identify the user objective, subject entity, constraints, missing inputs, and success criteria.',
  '- Prefer this flow: understand context -> read current facts -> check freshness -> parse rules if rules are provided -> simulate readiness -> explain with evidence -> suggest Review Gate or report.',
  '- When the user asks for a plan, produce numbered steps with tool names where useful and mark which steps require human review.',
  '',
  'Workbench context prompt:',
  '- Use the supplied Workbench context as the current page context only; do not treat it as verified business fact.',
  '- If selectedEntity is present, prefer using its entityId for tool calls when the tool schema supports it.',
  '- If required IDs are missing, first use discovery tools such as getDashboardContext, searchSkus, listRuleSets, or listActivities. Only ask the human after discovery tools cannot identify a safe candidate.',
  '- On Dashboard, Agent Mission, or overview pages, call getDashboardContext before making SKU readiness, risk, or next-action judgments.',
  '',
  'Rule parsing prompt:',
  '- When the user provides campaign or platform rule text, convert it conceptually into Canonical Rule DSL categories: threshold, field_compare, boolean_block, data_required, quota, manual_review.',
  '- Use parseActivityRules when sourceText is available. After parsing, report parseStatus, confidence if returned, blocking rules, required fields, and manual_review ambiguity points.',
  '- Low confidence, ambiguous natural language, missing threshold values, unclear time windows, conflicting rules, or legal/compliance judgment must become manual_review rather than a hard conclusion.',
  '',
  'Tool selection prompt:',
  '- Use registered PickAgent tools for SKU facts, data freshness, health diagnosis, activity readiness, rule parsing, evidence explanations, and report previews.',
  '- Do not skip from user intent directly to a conclusion. Prefer one or more tool calls before business judgments.',
  '- If a tool returns an error, empty result, stale data, or blocked policy, say that clearly and suggest the next safe read-only or review-gated step.',
  '',
  'Evidence explanation prompt:',
  '- Explain decisions by tying each conclusion to returned evidence: snapshot, diagnosis, rule, simulation, review_gate, report, or tool_result.',
  '- Use the eligibility/status labels returned by tools; do not rename them if the exact enum matters.',
  '- Distinguish long-term SKU health from activity-specific eligibility.',
  '',
  'Review Gate prompt:',
  '- Trigger a Review Gate recommendation for rule ambiguity, stale or missing data, multi-source conflict, L2 write-side actions, legal/compliance uncertainty, credential-sensitive input, or any action that would modify business records.',
  '- A Review Gate answer should include: question for the human, agent recommendation, risk if approved, risk if rejected, and evidence references when available.',
  '',
  'Report prompt:',
  '- For reports, summarize Ready rate or status mix when data is available, top blocking reasons, repairable SKU next actions, manual review queue, and evidence-backed next steps.',
].join('\n')

export interface VercelAiSdkAgentModelAdapterOptions {
  apiKey: string
  modelName: string
  baseURL?: string
  generateText?: GenerateText
  model?: LanguageModel
}

export class VercelAiSdkAgentModelAdapter implements AgentModelAdapter {
  readonly provider = 'vercel-ai-sdk'
  readonly model: string

  private readonly generate: GenerateText
  private readonly languageModel: LanguageModel

  constructor(options: VercelAiSdkAgentModelAdapterOptions) {
    this.model = options.modelName
    this.generate = options.generateText ?? generateText
    this.languageModel = options.model ?? createOpenAI({ apiKey: options.apiKey, baseURL: options.baseURL }).chat(options.modelName)
  }

  async complete(input: AgentModelAdapterInput): Promise<AgentModelAdapterOutput> {
    const userMessage = input.messages
      .filter((message) => message.role === 'user')
      .at(-1)?.contentText?.trim()
    if (!userMessage) throw new Error('Real Agent chat requires a user message')
    const toolExecutions: AgentConversationToolExecution[] = []
    const prefetchedContext = await prefetchContextTools(input, userMessage, toolExecutions)
    const messages = input.messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: message.contentText ?? '',
      }) as ModelMessage)

    try {
      const result = await this.generate({
        model: this.languageModel,
        system: renderPickAgentSystemPrompt(input, userMessage, messages, prefetchedContext),
        messages: [
          ...messages.slice(0, -1),
          {
            role: 'user' as const,
            content: prefetchedContext ? `User message:\n${userMessage}\n\nPrefetched PickAgent tool context:\n${prefetchedContext}` : `User message:\n${userMessage}`,
          },
        ],
        tools: createPickAgentTools(input, toolExecutions),
        toolChoice: 'auto',
        stopWhen: stepCountIs(3),
      })

      return {
        content: result.text,
        usageJson: {
          usage: result.usage,
          totalUsage: result.totalUsage,
          finishReason: result.finishReason,
        },
        metadataJson: {
          provider: this.provider,
          model: this.model,
          responseId: result.response.id,
          providerMetadata: result.providerMetadata ?? {},
        },
        toolExecutions,
      }
    } catch (error) {
      return completeWithReadOnlyToolFallback(input, userMessage, toolExecutions, error)
    }
  }
}

async function completeWithReadOnlyToolFallback(
  input: AgentModelAdapterInput,
  userMessage: string,
  toolExecutions: AgentConversationToolExecution[],
  error: unknown,
): Promise<AgentModelAdapterOutput> {
  const selectedEntity = input.context?.selectedEntity
  if (!toolExecutions.length && shouldPrefetchDashboardContext(input, userMessage)) {
    await prefetchContextTools(input, userMessage, toolExecutions)
  }

  const selectedEntityType = selectedEntity?.entityType ? String(selectedEntity.entityType) : ''
  if (input.executeTool && (selectedEntityType === 'sku_profile' || selectedEntityType === 'sku') && selectedEntity?.entityId) {
    for (const toolName of ['getSkuSummary', 'diagnoseSkuHealth', 'checkDataFreshness'] as const) {
      const execution = await input.executeTool({
        run: input.run,
        mission: input.mission,
        toolName,
        inputJson: toolName === 'checkDataFreshness' ? { skuProfileId: selectedEntity.entityId, maxAgeHours: 24 } : { skuProfileId: selectedEntity.entityId },
      })
      toolExecutions.push(execution)
    }
  }

  const businessSummary = toolExecutions.length
    ? toolExecutions.map((execution) => `${execution.toolCall.toolName}: ${execution.summary}`).join('；')
    : '当前没有足够上下文选择只读工具，请指定 SKU、规则文本或报告范围后重试。'
  const errorMessage = error instanceof Error ? error.message : 'model provider call failed'

  return {
    content: [
      '模型 provider 本次调用失败，我先用已注册的只读业务工具返回可验证结果。',
      `用户问题：${userMessage}`,
      `工具结果：${businessSummary}`,
      '如果要继续自然语言多轮推理，需要修复模型 provider 配置；业务工具和证据链路已经可用。',
    ].join('\n'),
    usageJson: {},
    metadataJson: {
      provider: 'vercel-ai-sdk',
      fallback: 'read_only_tool_fallback',
      originalError: error instanceof Error ? error.name : 'UnknownError',
      originalMessage: errorMessage.slice(0, 240),
    },
    toolExecutions,
  }
}

async function prefetchContextTools(
  input: AgentModelAdapterInput,
  userMessage: string,
  toolExecutions: AgentConversationToolExecution[],
): Promise<string> {
  if (!input.executeTool || !shouldPrefetchDashboardContext(input, userMessage)) return ''
  const execution = await input.executeTool({
    run: input.run,
    mission: input.mission,
    toolName: 'getDashboardContext',
    inputJson: buildDashboardPrefetchInput(input, userMessage),
  })
  toolExecutions.push(execution)
  return summarizePrefetchedToolExecutions([execution])
}

function shouldPrefetchDashboardContext(input: AgentModelAdapterInput, userMessage: string): boolean {
  const context = input.context as { route?: string; surface?: string; selectedEntity?: { entityType?: string } } | undefined
  const route = `${context?.route ?? ''} ${context?.surface ?? ''}`.toLowerCase()
  const selectedEntityType = context?.selectedEntity?.entityType ?? ''
  const text = userMessage.toLowerCase()
  return (
    route.includes('dashboard') ||
    route.includes('agent-mission') ||
    selectedEntityType === 'dashboard' ||
    selectedEntityType === 'activityRuleSet' ||
    /sku|ready|risk|风险|概览|dashboard|活动|报名|健康|证据|库存|销量|评分|修复/.test(text)
  )
}

function buildDashboardPrefetchInput(input: AgentModelAdapterInput, userMessage: string): Record<string, unknown> {
  const selectedEntity = input.context?.selectedEntity
  return {
    query: userMessage,
    page: 1,
    pageSize: 8,
    activityId: selectedEntity?.entityType === 'activity' ? selectedEntity.entityId : undefined,
  }
}

function summarizePrefetchedToolExecutions(executions: AgentConversationToolExecution[]): string {
  return executions
    .map((execution) => {
      const data = execution.data ? JSON.stringify(execution.data).slice(0, 2800) : ''
      return `${execution.toolCall.toolName} (${execution.status}): ${execution.summary}\n${data}`
    })
    .join('\n\n')
}

function renderPickAgentSystemPrompt(input: AgentModelAdapterInput, userMessage: string, messages: ModelMessage[], prefetchedContext = ''): string {
  return PICKAGENT_SYSTEM_PROMPT_TEMPLATE
    .replace('{{mission_objective}}', `Mission objective: ${input.mission.objective || userMessage}`)
    .replace('{{workbench_context_json}}', `Workbench context JSON: ${JSON.stringify(input.context ?? {})}\nPrefetched tool context: ${prefetchedContext || 'None'}`)
    .replace('{{available_tools}}', `Available tools: ${PICKAGENT_AVAILABLE_TOOLS.join(', ')}`)
    .replace('{{conversation_summary}}', `Conversation summary: ${summarizeConversation(messages)}`)
}

const PICKAGENT_AVAILABLE_TOOLS = [
  'getDashboardContext',
  'searchSkus',
  'listRuleSets',
  'listActivities',
  'createActivity',
  'updateActivity',
  'getActivityExecutionPlan',
  'startActivityRun',
  'parseActivityRules',
  'getSkuSummary',
  'checkDataFreshness',
  'diagnoseSkuHealth',
  'simulateActivityReadiness',
  'explainDecisionWithEvidence',
  'generateReport',
  'createReviewItems',
  'getReviewDetail',
  'updateReviewItem',
  'decideReviewItem',
  'setSkuNextAction',
  'listConnectors',
  'detectBrowserPage',
  'previewBrowserScan',
  'runConnectorSync',
  'setConnectorStatus',
  'setRuleSetStatus',
  'retryRun',
  'listReports',
  'getReportDetail',
  'listReportVersions',
  'getReportVersion',
  'exportReport',
  'subscribeReport',
] as const

function summarizeConversation(messages: ModelMessage[]): string {
  const recent = messages.slice(-6)
  if (!recent.length) return 'No prior conversation.'
  return recent
    .map((message) => {
      const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
      return `${message.role}: ${content.slice(0, 240)}`
    })
    .join('\n')
}

function createPickAgentTools(input: AgentModelAdapterInput, toolExecutions: AgentConversationToolExecution[]) {
  const executeTool = async (toolName: string, inputJson: unknown) => {
    if (!input.executeTool) {
      return {
        status: 'FAILED',
        summary: 'Agent tool executor is not configured.',
        data: null,
        evidenceRefs: [],
        linkedEntities: [],
      }
    }
    const execution = await input.executeTool({
      run: input.run,
      mission: input.mission,
      toolName,
      inputJson: objectInput(inputJson),
    })
    toolExecutions.push(execution)
    return {
      status: execution.status,
      summary: execution.summary,
      data: execution.data,
      evidenceRefs: execution.evidenceRefs,
      linkedEntities: execution.linkedEntities,
      reviewGateId: execution.reviewGate?.id ?? null,
    }
  }
  const objectSchema = jsonSchema({
    type: 'object',
    additionalProperties: true,
    properties: {
      skuProfileId: { type: 'string' },
      q: { type: 'string' },
      query: { type: 'string' },
      keyword: { type: 'string' },
      externalSkuId: { type: 'string' },
      productName: { type: 'string' },
      storeId: { type: 'string' },
      category: { type: 'string' },
      url: { type: 'string' },
      title: { type: 'string' },
      htmlTextSample: { type: 'string' },
      sample: { type: 'string' },
      activityName: { type: 'string' },
      activityId: { type: 'string' },
      connectorId: { type: 'string' },
      missionId: { type: 'string' },
      runId: { type: 'string' },
      runType: { type: 'string', enum: ['connector_sync', 'agent_run'] },
      reportId: { type: 'string' },
      versionId: { type: 'string' },
      reviewItemId: { type: 'string' },
      decision: { type: 'string', enum: ['APPROVE', 'REJECT', 'REQUEST_CHANGES'] },
      decisionBy: { type: 'string' },
      decisionComment: { type: 'string' },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'NEEDS_AUTH', 'FAILED', 'DISABLED', 'ENABLED', 'DRAFT', 'RUNNING', 'COMPLETED'] },
      healthStatus: { type: 'string', enum: ['READY', 'REPAIRABLE', 'RISKY', 'BLOCKED'] },
      eligibilityStatus: { type: 'string', enum: ['DIRECT_READY', 'REPAIRABLE_READY', 'MANUAL_REVIEW', 'BLOCKED'] },
      minSales30d: { type: 'number' },
      maxSales30d: { type: 'number' },
      minPositiveRate: { type: 'number' },
      maxPositiveRate: { type: 'number' },
      minStock: { type: 'number' },
      maxStock: { type: 'number' },
      sortBy: { type: 'string', enum: ['sales30d', 'positiveRate', 'stock', 'qualityScore', 'collectedAt', 'updatedAt'] },
      sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      page: { type: 'number' },
      pageSize: { type: 'number' },
      ruleSetId: { type: 'string' },
      simulationResultId: { type: 'string' },
      name: { type: 'string' },
      platform: { type: 'string' },
      sourceText: { type: 'string' },
      scope: { type: 'string' },
      productScopeText: { type: 'string' },
      startAt: { type: 'string' },
      endAt: { type: 'string' },
      question: { type: 'string' },
      sourceId: { type: 'string' },
      sourceType: { type: 'string', enum: ['health', 'simulation', 'agent'] },
      recommendation: { type: 'string' },
      recommendationText: { type: 'string' },
      riskLevel: { type: 'string', enum: ['L0', 'L1', 'L2'] },
      label: { type: 'string' },
      comment: { type: 'string' },
      nextAction: {
        type: 'object',
        additionalProperties: true,
        properties: {
          type: { type: 'string', enum: ['JOIN_ACTIVITY', 'REPAIR_ISSUE', 'VIEW_DETAIL', 'VIEW_BLOCKER', 'MANUAL_REVIEW'] },
          label: { type: 'string' },
          disabled: { type: 'boolean' },
        },
      },
      type: { type: 'string', enum: ['HEALTH', 'ACTIVITY'] },
      format: { type: 'string', enum: ['PDF', 'EXCEL', 'PPT'] },
      frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'OFF'] },
      recipients: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
      rowCount: { type: 'number' },
      qualityScore: { type: 'number' },
      summary: { type: 'object', additionalProperties: true },
      modifiedPayload: { type: 'object', additionalProperties: true },
      rows: { type: 'array', items: { type: 'object', additionalProperties: true } },
      categoryScope: { type: 'array', items: { type: 'string' } },
      skuProfileIds: { type: 'array', items: { type: 'string' } },
      simulationResultIds: { type: 'array', items: { type: 'string' } },
      maxAgeHours: { type: 'number' },
    },
  })
  return {
    getDashboardContext: tool({
      description: '读取当前 Dashboard/Agent Mission 所需上下文：健康汇总、SKU 候选、规则集、活动列表。没有明确 skuProfileId 时必须优先调用。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('getDashboardContext', inputJson),
    }),
    searchSkus: tool({
      description: '按自然语言或结构化条件查询 SKU 候选。支持 query/q、productName、externalSkuId、category、platform、healthStatus、eligibilityStatus、库存/销量/评分区间、排序和分页。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('searchSkus', inputJson),
    }),
    listRuleSets: tool({
      description: '读取可用活动规则集列表，用于用户只说活动/规则但没有 ruleSetId 的场景。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('listRuleSets', inputJson),
    }),
    listActivities: tool({
      description: '读取活动列表，用于用户只说活动名或当前活动上下文不足的场景。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('listActivities', inputJson),
    }),
    createActivity: tool({
      description: '创建真实活动对象。需要 name，可选 platform/categoryScope/productScopeText/startAt/endAt。用于用户要求新增活动、活动准备项目或活动执行目标时。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('createActivity', inputJson),
    }),
    updateActivity: tool({
      description: '更新真实活动对象。需要 activityId，可选 name/platform/categoryScope/productScopeText/status/startAt/endAt。用于修改活动状态、范围或时间。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('updateActivity', inputJson),
    }),
    getActivityExecutionPlan: tool({
      description: '读取活动执行计划。需要 activityId，返回步骤、必需字段、待确认项和相关 run。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('getActivityExecutionPlan', inputJson),
    }),
    startActivityRun: tool({
      description: '启动真实活动执行路径 run。需要 activityId。用于用户明确要求开始执行、启动活动流程或生成运行计划时。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('startActivityRun', inputJson),
    }),
    parseActivityRules: tool({
      description: '把活动或平台规则文本解析为 Canonical Rule DSL。需要 sourceText，可选 name/platform。用于规则结构化、歧义识别和 manual_review 提示。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('parseActivityRules', normalizeRuleParseInput(inputJson)),
    }),
    getSkuSummary: tool({
      description: '读取 SKU 当前健康摘要。需要 skuProfileId。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('getSkuSummary', inputJson),
    }),
    checkDataFreshness: tool({
      description: '检查 SKU 采集数据是否仍在时效窗口内。需要 skuProfileId，可选 maxAgeHours。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('checkDataFreshness', inputJson),
    }),
    diagnoseSkuHealth: tool({
      description: '返回 SKU 最新健康诊断。需要 skuProfileId。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('diagnoseSkuHealth', inputJson),
    }),
    simulateActivityReadiness: tool({
      description: '执行活动准入模拟并写入运行记录。需要 ruleSetId 和 skuProfileIds。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('simulateActivityReadiness', inputJson),
    }),
    explainDecisionWithEvidence: tool({
      description: '基于健康诊断和模拟结果输出证据解释。需要 skuProfileId，可选 simulationResultId/question。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('explainDecisionWithEvidence', inputJson),
    }),
    generateReport: tool({
      description: '生成真实健康或活动报告，并写入报告中心。需要 type 和 skuProfileIds。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('generateReport', inputJson),
    }),
    createReviewItems: tool({
      description: '创建真实人工 Review 项。用于规则歧义、数据冲突、L2 写动作前置确认或用户明确要求提交人工复核。需要 skuProfileId 或 sourceId，建议提供 question/recommendation/riskLevel。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('createReviewItems', inputJson),
    }),
    getReviewDetail: tool({
      description: '读取真实 Review 详情。需要 reviewItemId，返回建议、风险、证据、相关规则和审批历史。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('getReviewDetail', inputJson),
    }),
    updateReviewItem: tool({
      description: '更新真实 Review 项的 question/recommendation/riskLevel。需要 reviewItemId，并至少提供 question、recommendation 或 riskLevel。适合用户要求修改 Review 建议但尚未审批时使用。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('updateReviewItem', inputJson),
    }),
    decideReviewItem: tool({
      description: '对真实 Review 项执行审批决策。需要 reviewItemId 和 decision=APPROVE/REJECT/REQUEST_CHANGES，可选 decisionComment/modifiedPayload。只能在用户明确要求批准、驳回或要求修改时使用。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('decideReviewItem', inputJson),
    }),
    setSkuNextAction: tool({
      description: '设置 SKU 工作台里的下一步动作。需要 skuProfileId 和 nextAction 或 type/label。适合记录“下一步查看阻塞、进入人工确认、修复问题”等操作。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('setSkuNextAction', inputJson),
    }),
    listConnectors: tool({
      description: '读取数据源连接器列表，用于回答数据源、权限、最近采集状态、连接器健康情况。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('listConnectors', inputJson),
    }),
    detectBrowserPage: tool({
      description: '识别浏览器当前页面是否是可采集的电商商品页面。需要 url，可选 title/htmlTextSample。只返回识别结果，不写入业务数据。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('detectBrowserPage', inputJson),
    }),
    previewBrowserScan: tool({
      description: '对浏览器扫描到的 rows 做字段映射和采集质量预览。需要 url 和 rows，可选 connectorId/collectedAt。只做预览，不写入 SKU 档案。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('previewBrowserScan', inputJson),
    }),
    runConnectorSync: tool({
      description: '为指定 connectorId 创建真实采集运行记录。用于用户明确要求立即同步、重跑采集、刷新数据源时。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('runConnectorSync', inputJson),
    }),
    setConnectorStatus: tool({
      description: '启用、停用或更新连接器状态。需要 connectorId 和 status=ACTIVE/DISABLED/INACTIVE/NEEDS_AUTH/FAILED。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('setConnectorStatus', inputJson),
    }),
    setRuleSetStatus: tool({
      description: '启用、停用或恢复草稿规则集。需要 ruleSetId 和 status=ENABLED/DISABLED/DRAFT。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('setRuleSetStatus', inputJson),
    }),
    retryRun: tool({
      description: '为失败运行创建真实重试运行。连接器运行需要 runType=connector_sync 和 connectorId/sourceId；Agent 运行需要 runType=agent_run 和 missionId/sourceId；可选 runId 记录 retryOf。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('retryRun', inputJson),
    }),
    listReports: tool({
      description: '读取报告中心报告列表，用于查找 reportId、最新报告、导出状态和报告时间。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('listReports', inputJson),
    }),
    getReportDetail: tool({
      description: '读取真实报告详情。需要 reportId，返回摘要、风险、修复建议、证据和各标签页内容所需数据。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('getReportDetail', inputJson),
    }),
    listReportVersions: tool({
      description: '读取指定 reportId 的真实报告版本列表，用于用户询问历史版本或版本对比前查找 versionId。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('listReportVersions', inputJson),
    }),
    getReportVersion: tool({
      description: '读取指定 reportId/versionId 的真实报告版本详情。需要 reportId 和 versionId。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('getReportVersion', inputJson),
    }),
    exportReport: tool({
      description: '为指定 reportId 创建真实报告导出任务。支持 format=PDF/EXCEL/PPT。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('exportReport', inputJson),
    }),
    subscribeReport: tool({
      description: '更新指定 reportId 的报告订阅。支持 frequency=DAILY/WEEKLY/MONTHLY/OFF 和 recipients。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('subscribeReport', inputJson),
    }),
  }
}

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function normalizeRuleParseInput(value: unknown): Record<string, unknown> {
  const input = objectInput(value)
  return {
    name: typeof input.name === 'string' && input.name.trim() ? input.name : 'Agent Copilot 活动规则',
    platform: typeof input.platform === 'string' && input.platform.trim() ? input.platform : 'agent-copilot',
    sourceText: typeof input.sourceText === 'string' ? input.sourceText : '',
  }
}

export function createVercelAiSdkAgentModelAdapterFromEnv(env: Record<string, string | undefined> = process.env): VercelAiSdkAgentModelAdapter | undefined {
  const apiKey = env.OPENAI_API_KEY?.trim()
  const modelName = (env.PICKAGENT_AGENT_MODEL ?? env.OPENAI_MODEL ?? 'gpt-4.1-mini').trim()
  if (!apiKey || !modelName) return undefined
  return new VercelAiSdkAgentModelAdapter({
    apiKey,
    modelName,
    baseURL: env.OPENAI_BASE_URL?.trim() || undefined,
  })
}
