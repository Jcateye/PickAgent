import assert from 'node:assert/strict'
import test from 'node:test'

import { executeFinalApiTool, isAgentToolDeniedBySettings, POST } from '../src/app/api/agent/chat/route'
import { finalApiRuntime } from '../src/app/api/_final-api-runtime'

test('agent chat route fails closed instead of returning template replies when real runtime is missing', async () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY
  const previousOpenAiModel = process.env.OPENAI_MODEL
  const previousPickAgentModel = process.env.PICKAGENT_AGENT_MODEL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.PICKAGENT_AGENT_MODEL
  try {
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
  } finally {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousOpenAiKey
    if (previousOpenAiModel === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = previousOpenAiModel
    if (previousPickAgentModel === undefined) delete process.env.PICKAGENT_AGENT_MODEL
    else process.env.PICKAGENT_AGENT_MODEL = previousPickAgentModel
  }
})

test('agent chat tools write backend workflow audits with agent auth context', async () => {
  const beforeIds = new Set(Array.from(finalApiRuntime.store.workflowAudits.keys()))

  const execution = await executeFinalApiTool('parseActivityRules', {
    name: 'Agent Chat 规则解析审计',
    platform: 'tmall',
    sourceText: '活动库存不得低于 30 件，好评率不少于 95%。',
  })

  assert.equal(execution.status, 'SUCCEEDED')
  const newAudits = Array.from(finalApiRuntime.store.workflowAudits.entries())
    .filter(([workflowRunId]) => !beforeIds.has(workflowRunId))
    .map(([, audit]) => audit)
  const parseAudit = newAudits.find((audit) => audit.workflowType === 'activity_rule_parse')

  assert.ok(parseAudit)
  assert.equal(parseAudit.input.actorId, 'agent_demo')
  assert.equal(finalApiRuntime.store.tenantByEntityId.get(parseAudit.workflowRunId), 'dev_tenant')
})

test('agent chat tool policy treats an empty allowlist as deny all', () => {
  assert.equal(isAgentToolDeniedBySettings('getSkuSummary', { allowedAgentTools: [], deniedRuntimeTools: [] }), true)
  assert.equal(isAgentToolDeniedBySettings('getSkuSummary', { allowedAgentTools: ['getSkuSummary'], deniedRuntimeTools: [] }), false)
  assert.equal(isAgentToolDeniedBySettings('getSkuSummary', { allowedAgentTools: ['getSkuSummary'], deniedRuntimeTools: ['getSkuSummary'] }), true)
})
