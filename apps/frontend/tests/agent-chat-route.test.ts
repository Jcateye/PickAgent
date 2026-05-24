import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from '../src/app/api/agent/chat/route'

test('agent chat route fails closed instead of returning template replies when real runtime is missing', async () => {
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

  assert.equal(response.status, 503)
  const envelope = (await response.json()) as {
    code: string
    data: null
    details: { missing: string[] }
  }

  assert.equal(envelope.code, 'AGENT.REAL_CHAT_NOT_CONFIGURED')
  assert.equal(envelope.data, null)
  assert.deepEqual(envelope.details.missing, ['AgentConversationRepository', 'AgentModelAdapter'])
})
