import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import type { AgentModelAdapter, AgentModelAdapterInput, AgentModelAdapterOutput } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'
import type { LanguageModel } from 'ai'

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

    const result = await this.generate({
      model: this.languageModel,
      system: [
        'You are PickAgent Copilot, a concise operator-facing assistant.',
        'Answer in Chinese by default.',
        'Do not invent SKU facts, campaign rules, prices, credentials, or platform actions.',
        'If business data or actions are required, explain that a registered PickAgent tool must be used through AgentToolRegistry.',
      ].join('\n'),
      prompt: [
        `User message:\n${userMessage}`,
        `Workbench context:\n${JSON.stringify(input.context ?? {})}`,
      ].join('\n\n'),
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
    }
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
