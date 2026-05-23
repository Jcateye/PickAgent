import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from '../src/app/api/agent/chat/route'

test('agent chat route stays blank-first and only responds after a real user message', async () => {
  const response = await POST(
    new Request('http://localhost/api/agent/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionKey: 'agent-chat-test-session',
        message: '请分析当前 SKU 的健康风险，并解释原因',
        context: {
          route: '/sku-health',
          pageTitle: 'SKU Health',
          selectedEntity: {
            entityType: 'sku',
            entityId: 'sku_0001',
            label: '测试 SKU',
          },
          visibleFilters: {},
          visibleColumns: ['status', 'evidence'],
        },
      }),
    }),
  )

  assert.equal(response.status, 200)
  const envelope = (await response.json()) as {
    code: string
    data: {
      runId: string
      assistantMessage: { content: string }
      toolTrace: Array<{ toolName: string }>
      fallbackUsed: boolean
    }
  }

  assert.equal(envelope.code, 'OK')
  assert.equal(envelope.data.fallbackUsed, false)
  assert.ok(envelope.data.runId)
  assert.match(envelope.data.assistantMessage.content, /SKU|健康|建议/)
  assert.ok(envelope.data.toolTrace.some((item) => item.toolName === 'getSkuSummary'))
  assert.ok(envelope.data.toolTrace.some((item) => item.toolName === 'diagnoseSkuHealth'))
})
