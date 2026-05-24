import assert from 'node:assert/strict'
import test from 'node:test'

import { VercelAiSdkAgentModelAdapter, createVercelAiSdkAgentModelAdapterFromEnv } from '../src/app/api/agent/chat/vercel-ai-sdk-agent-model-adapter'

test('vercel ai sdk agent model adapter delegates assistant reply to generateText', async () => {
  const calls: Array<{ system?: string; prompt?: string }> = []
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
  assert.match(calls[0].prompt ?? '', /帮我分析这个 SKU/)
  assert.match(calls[0].prompt ?? '', /sku_1/)
})

test('vercel ai sdk model adapter env factory fails closed without key', () => {
  assert.equal(createVercelAiSdkAgentModelAdapterFromEnv({}), undefined)
  assert.equal(createVercelAiSdkAgentModelAdapterFromEnv({ OPENAI_API_KEY: '   ' }), undefined)
})
