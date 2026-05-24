import { createOpenAI } from '@ai-sdk/openai'
import { generateText, jsonSchema, stepCountIs, tool } from 'ai'

import type { AgentConversationToolExecution, AgentModelAdapter, AgentModelAdapterInput, AgentModelAdapterOutput } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import type { LanguageModel, ModelMessage } from 'ai'

type GenerateText = typeof generateText

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
      system: [
        'You are PickAgent Copilot, a concise operator-facing assistant.',
        'Answer in Chinese by default.',
        'Do not invent SKU facts, campaign rules, prices, credentials, or platform actions.',
        'Use the registered PickAgent read-only tools when the user asks about SKU facts, freshness, diagnosis, activity readiness, evidence, or reports.',
        'When tools return errors or empty data, say that clearly and suggest the next safe read-only step.',
      ].join('\n'),
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
      question: { type: 'string' },
      type: { type: 'string', enum: ['HEALTH', 'ACTIVITY'] },
      skuProfileIds: { type: 'array', items: { type: 'string' } },
      simulationResultIds: { type: 'array', items: { type: 'string' } },
      maxAgeHours: { type: 'number' },
    },
  })
  return {
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
