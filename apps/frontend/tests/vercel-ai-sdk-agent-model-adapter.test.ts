import assert from 'node:assert/strict'
import test from 'node:test'

import { VercelAiSdkAgentModelAdapter, createVercelAiSdkAgentModelAdapterFromEnv } from '../src/app/api/agent/chat/vercel-ai-sdk-agent-model-adapter'

test('vercel ai sdk agent model adapter delegates assistant reply to generateText', async () => {
  const calls: Array<{ system?: string; prompt?: string; messages?: Array<{ content?: string }> }> = []
  const adapter = new VercelAiSdkAgentModelAdapter({
    apiKey: 'test-key',
    modelName: 'test-model',
    model: { specificationVersion: 'v2', provider: 'test', modelId: 'test-model' } as never,
    generateText: (async (input: { system?: string; prompt?: string }) => {
      calls.push(input)
      return {
        text: 'AI SDK 生成的真实回复',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        totalUsage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        finishReason: 'stop',
        response: { id: 'response_test_1' },
        providerMetadata: { openai: { responseId: 'response_test_1' } },
      }
    }) as never,
  })

  const result = await adapter.complete({
    session: { id: 'session_1', sessionKey: 's', userId: null, surface: 'agent-copilot', piSessionKey: null, piSessionRef: null, title: null, status: 'ACTIVE', configJson: {}, lastActiveAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    mission: { id: 'mission_1', sessionId: 'session_1', missionType: 'goal_driven', objective: '分析 SKU', autonomyLevel: 'review_required', status: 'ACTIVE', sourceSurface: 'agent-copilot', subjectType: 'sku', subjectId: 'sku_1', constraintsJson: {}, workbenchContextJson: {}, planJson: {}, nextActionsJson: {}, createdBy: null, completedAt: null, canceledAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    run: { id: 'run_1', missionId: 'mission_1', sessionId: 'session_1', piRunId: null, workflowRunId: null, status: 'RUNNING', modelProvider: 'vercel-ai-sdk', modelName: 'test-model', inputJson: {}, outputJson: {}, errorMessage: null, timeoutMs: null, cancelRequested: false, usageJson: {}, metadataJson: {}, startedAt: '2026-05-24T00:00:00.000Z', completedAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    messages: [{ id: 'message_1', sessionId: 'session_1', runId: 'run_1', role: 'user', orderIndex: 1, contentText: '帮我分析这个 SKU', contentJson: {}, status: 'completed', parentId: null, createdAt: '2026-05-24T00:00:00.000Z' }],
    context: { route: '/sku-health', selectedEntity: { entityType: 'sku', entityId: 'sku_1', label: '测试 SKU' } },
  })

  assert.equal(result.content, 'AI SDK 生成的真实回复')
  assert.equal(result.metadataJson?.provider, 'vercel-ai-sdk')
  assert.equal(result.metadataJson?.model, 'test-model')
  assert.match(calls[0].system ?? '', /AgentToolRegistry/)
  assert.match(calls[0].system ?? '', /Mission objective: 分析 SKU/)
  assert.match(calls[0].system ?? '', /sku_1/)
  assert.match(calls[0].messages?.at(-1)?.content ?? '', /帮我分析这个 SKU/)
})

test('vercel ai sdk agent model adapter exposes activity rule parsing as an executable tool', async () => {
  const executedTools: Array<{ toolName: string; inputJson: Record<string, unknown> }> = []
  const adapter = new VercelAiSdkAgentModelAdapter({
    apiKey: 'test-key',
    modelName: 'test-model',
    model: { specificationVersion: 'v2', provider: 'test', modelId: 'test-model' } as never,
    generateText: (async (input: { tools?: Record<string, { execute?: (input: unknown) => Promise<unknown> }> }) => {
      const parseResult = await input.tools?.parseActivityRules?.execute?.({ sourceText: '活动库存不少于 20，好评率不少于 92%，证书状态必须有效。' })
      assert.deepEqual(parseResult, {
        status: 'SUCCEEDED',
        summary: 'parsed',
        data: { ruleSetId: 'rules_1', parseStatus: 'PARSED' },
        evidenceRefs: [],
        linkedEntities: [],
        reviewGateId: null,
      })
      return {
        text: '已解析活动规则',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        totalUsage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        finishReason: 'stop',
        response: { id: 'response_test_2' },
        providerMetadata: {},
      }
    }) as never,
  })

  const result = await adapter.complete({
    session: { id: 'session_1', sessionKey: 's', userId: null, surface: 'agent-copilot', piSessionKey: null, piSessionRef: null, title: null, status: 'ACTIVE', configJson: {}, lastActiveAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    mission: { id: 'mission_1', sessionId: 'session_1', missionType: 'goal_driven', objective: '解析活动规则', autonomyLevel: 'review_required', status: 'ACTIVE', sourceSurface: 'agent-copilot', subjectType: null, subjectId: null, constraintsJson: {}, workbenchContextJson: {}, planJson: {}, nextActionsJson: {}, createdBy: null, completedAt: null, canceledAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    run: { id: 'run_1', missionId: 'mission_1', sessionId: 'session_1', piRunId: null, workflowRunId: null, status: 'RUNNING', modelProvider: 'vercel-ai-sdk', modelName: 'test-model', inputJson: {}, outputJson: {}, errorMessage: null, timeoutMs: null, cancelRequested: false, usageJson: {}, metadataJson: {}, startedAt: '2026-05-24T00:00:00.000Z', completedAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    messages: [{ id: 'message_1', sessionId: 'session_1', runId: 'run_1', role: 'user', orderIndex: 1, contentText: '解析这段活动规则', contentJson: {}, status: 'completed', parentId: null, createdAt: '2026-05-24T00:00:00.000Z' }],
    executeTool: async (input) => {
      executedTools.push({ toolName: input.toolName, inputJson: input.inputJson })
      return {
        toolCall: { id: 'tool_1', runId: input.run.id, externalToolCallId: null, workflowStepId: null, toolName: input.toolName, status: 'SUCCEEDED', riskLevel: 'L1', reviewPolicy: 'AUTO_ALLOW', inputJson: input.inputJson, outputJson: {}, evidenceRefsJson: {}, errorMessage: null, blockedReason: null, startedAt: '2026-05-24T00:00:00.000Z', completedAt: '2026-05-24T00:00:00.000Z', createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
        status: 'SUCCEEDED',
        summary: 'parsed',
        data: { ruleSetId: 'rules_1', parseStatus: 'PARSED' },
        evidenceRefs: [],
        linkedEntities: [],
        reviewGate: null,
      }
    },
  })

  assert.equal(result.content, '已解析活动规则')
  assert.equal(result.toolExecutions?.[0]?.toolCall.toolName, 'parseActivityRules')
  assert.deepEqual(executedTools, [{
    toolName: 'parseActivityRules',
    inputJson: {
      name: 'Agent Copilot 活动规则',
      platform: 'agent-copilot',
      sourceText: '活动库存不少于 20，好评率不少于 92%，证书状态必须有效。',
    },
  }])
})

test('vercel ai sdk model adapter env factory fails closed without key', () => {
  assert.equal(createVercelAiSdkAgentModelAdapterFromEnv({}), undefined)
  assert.equal(createVercelAiSdkAgentModelAdapterFromEnv({ OPENAI_API_KEY: '   ' }), undefined)
})
