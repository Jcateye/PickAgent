import assert from 'node:assert/strict'
import test from 'node:test'

import { agentToolRequiresReviewGate, agentToolRiskLevel, createPersistentToolExecutor, executeFinalApiTool, isAgentToolDeniedBySettings, POST } from '../src/app/api/agent/chat/route'
import { executeApprovedChatReviewGateTool } from '../src/app/api/agent/review-gates/[gateId]/decision/route'
import { toRecoveredTurn } from '../src/app/api/agent/sessions/[sessionKey]/messages/route'
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

test('agent chat classifies report-producing tools as write risk', () => {
  assert.equal(agentToolRiskLevel('generateReport'), 'L2')
  assert.equal(agentToolRiskLevel('generateReportPreview'), 'L2')
  assert.equal(agentToolRiskLevel('reportPreview'), 'L2')
  assert.equal(agentToolRiskLevel('compareReports'), 'L2')
  assert.equal(agentToolRiskLevel('getReportDetail'), 'L1')
  assert.equal(agentToolRequiresReviewGate('generateReport'), true)
  assert.equal(agentToolRequiresReviewGate('generateReportPreview'), true)
  assert.equal(agentToolRequiresReviewGate('reportPreview'), true)
  assert.equal(agentToolRequiresReviewGate('getReportDetail'), false)
})

test('agent chat persistent executor opens review gate before write tools', async () => {
  const beforeReportCount = finalApiRuntime.store.reports.size
  const calls: Array<{ kind: string; input: Record<string, unknown> }> = []
  const repository = {
    createToolCall: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'toolCall', input })
      return { id: 'tool_call_review_1', ...input }
    },
    createReviewGate: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'reviewGate', input })
      return { id: 'gate_review_1', status: 'PENDING', ...input }
    },
    appendRunEvent: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'event', input })
      return { id: 'event_review_1', ...input }
    },
  }

  const executor = createPersistentToolExecutor(repository as never)
  const execution = await executor({
    run: { id: 'run_review_1' } as never,
    mission: { id: 'mission_review_1' } as never,
    toolName: 'generateReport',
    inputJson: { skuProfileIds: ['sku_should_not_write_before_review'] },
  })

  assert.equal(execution.status, 'WAITING_FOR_APPROVAL')
  assert.equal(execution.toolCall.reviewPolicy, 'REVIEW_GATE')
  assert.equal(execution.reviewGate?.id, 'gate_review_1')
  assert.equal(finalApiRuntime.store.reports.size, beforeReportCount)
  assert.deepEqual(calls.map((item) => item.kind), ['toolCall', 'reviewGate', 'event'])
})

test('agent chat persistent executor gates report preview aliases before write', async () => {
  const beforeReportCount = finalApiRuntime.store.reports.size
  const calls: Array<{ kind: string; input: Record<string, unknown> }> = []
  const repository = {
    createToolCall: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'toolCall', input })
      return { id: `tool_call_${calls.length}`, ...input }
    },
    createReviewGate: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'reviewGate', input })
      return { id: `gate_${calls.length}`, status: 'PENDING', ...input }
    },
    appendRunEvent: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'event', input })
      return { id: `event_${calls.length}`, ...input }
    },
  }
  const executor = createPersistentToolExecutor(repository as never)

  const preview = await executor({
    run: { id: 'run_report_preview_1' } as never,
    mission: { id: 'mission_report_preview_1' } as never,
    toolName: 'generateReportPreview',
    inputJson: { skuProfileIds: ['sku_preview_should_not_write'] },
  })
  const legacy = await executor({
    run: { id: 'run_report_preview_2' } as never,
    mission: { id: 'mission_report_preview_2' } as never,
    toolName: 'reportPreview',
    inputJson: { skuProfileIds: ['sku_legacy_preview_should_not_write'] },
  })

  assert.equal(preview.status, 'WAITING_FOR_APPROVAL')
  assert.equal(legacy.status, 'WAITING_FOR_APPROVAL')
  assert.equal(preview.toolCall.toolName, 'generateReport')
  assert.equal(legacy.toolCall.toolName, 'generateReport')
  assert.equal(finalApiRuntime.store.reports.size, beforeReportCount)
  assert.deepEqual(calls.map((item) => item.kind), ['toolCall', 'reviewGate', 'event', 'toolCall', 'reviewGate', 'event'])
})

test('agent chat session recovery preserves review gate turns', () => {
  const turn = toRecoveredTurn({
    toolExecutions: [
      {
        toolCallId: 'tool_call_review_1',
        toolName: 'generateReport',
        status: 'WAITING_FOR_APPROVAL',
        riskLevel: 'L2',
        reviewPolicy: 'REVIEW_GATE',
        summary: '等待人工确认后执行 generateReport',
        reviewGateId: 'gate_review_1',
      },
    ],
  }, 'run_review_1')

  assert.equal(turn?.toolTrace[0]?.status, 'waiting_for_approval')
  assert.equal(turn?.toolTrace[0]?.riskLevel, 'L2')
  assert.equal(turn?.toolTrace[0]?.reviewPolicy, 'review_gate')
  assert.equal(turn?.reviewGate?.id, 'gate_review_1')
  assert.equal(turn?.reviewGate?.status, 'PENDING')
})

test('approved chat review gate executes original write tool on continuation run', async () => {
  const beforeReportCount = finalApiRuntime.store.reports.size
  const calls: Array<{ kind: string; input: Record<string, unknown> }> = []
  const repository = {
    createToolCall: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'toolCall', input })
      return { id: 'tool_call_executed_1', ...input }
    },
    appendRunEvent: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'event', input })
      return { id: 'event_executed_1', ...input }
    },
    markRunStatus: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'runStatus', input })
      return { id: input.runId, status: input.status, outputJson: input.outputJson }
    },
  }

  const result = await executeApprovedChatReviewGateTool(repository as never, {
    gate: { status: 'APPROVED' },
    continuationRun: { id: 'run_continuation_1' } as never,
    approvedToolCall: {
      id: 'tool_call_review_1',
      runId: 'run_review_1',
      externalToolCallId: null,
      workflowStepId: null,
      toolName: 'generateReport',
      status: 'WAITING_FOR_APPROVAL',
      riskLevel: 'L2',
      reviewPolicy: 'REVIEW_GATE',
      inputJson: { skuProfileIds: ['sku_missing_but_report_writes'] },
      outputJson: {},
      evidenceRefsJson: {},
      errorMessage: null,
      blockedReason: null,
      startedAt: '2026-05-24T00:00:00.000Z',
      completedAt: null,
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z',
    },
  })

  assert.equal(finalApiRuntime.store.reports.size, beforeReportCount + 1)
  assert.equal((result as { executedToolCall?: { toolName?: string } }).executedToolCall?.toolName, 'generateReport')
  assert.deepEqual(calls.map((item) => item.kind), ['toolCall', 'event', 'runStatus'])
  assert.equal(calls[0]?.input.runId, 'run_continuation_1')
  assert.equal(calls[2]?.input.status, 'SUCCEEDED')
})
