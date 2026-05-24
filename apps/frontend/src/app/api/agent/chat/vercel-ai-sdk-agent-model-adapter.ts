import { createOpenAI } from '@ai-sdk/openai'
import { generateText, jsonSchema, stepCountIs, tool } from 'ai'

import type { AgentConversationToolExecution, AgentModelAdapter, AgentModelAdapterInput, AgentModelAdapterOutput } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import type { LanguageModel, ModelMessage } from 'ai'

type GenerateText = typeof generateText

const PICKAGENT_SYSTEM_PROMPT = [
  'You are PickAgent Copilot, an operator-facing execution assistant for SKU Ready Agent.',
  'Answer in Chinese by default. Be concise, operational, and evidence-first.',
  '',
  'Stable boundaries:',
  '- The product is not a generic chatbot. It helps operators turn campaign goals and platform rules into SKU readiness checks, execution plans, evidence explanations, reports, and human Review Gate questions.',
  '- Never invent SKU facts, campaign rules, prices, credentials, platform actions, evidence IDs, or tool results.',
  '- Never claim that a SKU is ready, blocked, repairable, or safe unless that conclusion comes from a registered PickAgent tool result.',
  '- Never suggest automatic price changes, campaign submission, product page edits, procurement orders, credential access, direct SQL, shell, file, or production-changing browser actions.',
  '- Treat write-side or high-impact actions as Review Gate candidates. If a needed action is outside the exposed tools, describe the safe next step instead of pretending it was done.',
  '',
  'Mission planning prompt:',
  '- First identify the user objective, subject entity, constraints, missing inputs, and success criteria.',
  '- Prefer this flow: understand context -> read current facts -> check freshness -> parse rules if rules are provided -> simulate readiness -> explain with evidence -> suggest Review Gate or report.',
  '- When the user asks for a plan, produce numbered steps with tool names where useful and mark which steps require human review.',
  '',
  'Workbench context prompt:',
  '- Use the supplied Workbench context as the current page context only; do not treat it as verified business fact.',
  '- If selectedEntity is present, prefer using its entityId for tool calls when the tool schema supports it.',
  '- If required IDs are missing, ask for the smallest missing identifier or suggest the page action that would provide it.',
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
    const messages = input.messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: message.contentText ?? '',
      }) as ModelMessage)

    const result = await this.generate({
      model: this.languageModel,
      system: PICKAGENT_SYSTEM_PROMPT,
      messages: [
        ...messages.slice(0, -1),
        {
          role: 'user' as const,
          content: [
            `User message:\n${userMessage}`,
            `Workbench context:\n${JSON.stringify(input.context ?? {})}`,
          ].join('\n\n'),
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
  }
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
      ruleSetId: { type: 'string' },
      simulationResultId: { type: 'string' },
      name: { type: 'string' },
      platform: { type: 'string' },
      sourceText: { type: 'string' },
      question: { type: 'string' },
      type: { type: 'string', enum: ['HEALTH', 'ACTIVITY'] },
      skuProfileIds: { type: 'array', items: { type: 'string' } },
      simulationResultIds: { type: 'array', items: { type: 'string' } },
      maxAgeHours: { type: 'number' },
    },
  })
  return {
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
      description: '执行活动准入模拟预览。需要 ruleSetId 和 skuProfileIds。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('simulateActivityReadiness', inputJson),
    }),
    explainDecisionWithEvidence: tool({
      description: '基于健康诊断和模拟结果输出证据解释。需要 skuProfileId，可选 simulationResultId/question。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('explainDecisionWithEvidence', inputJson),
    }),
    reportPreview: tool({
      description: '生成健康或活动报告预览。需要 type 和 skuProfileIds。',
      inputSchema: objectSchema,
      execute: (inputJson) => executeTool('generateReportPreview', inputJson),
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
