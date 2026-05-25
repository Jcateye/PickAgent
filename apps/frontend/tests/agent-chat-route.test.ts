import assert from 'node:assert/strict'
import test from 'node:test'

import { agentToolRequiresReviewGate, agentToolRiskLevel, createPersistentToolExecutor, executeFinalApiTool, isAgentToolDeniedBySettings, POST } from '../src/app/api/agent/chat/route'
import { executeApprovedChatReviewGateTool } from '../src/app/api/agent/review-gates/[gateId]/decision/route'
import { toRecoveredTurn } from '../src/app/api/agent/sessions/recovered-turn'
import { finalApiRuntime, finalReportSnapshotRequest } from '../src/app/api/_final-api-runtime'

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

test('agent chat listRunConsole tool reads workflow audits from run console', async () => {
  const beforeIds = new Set(Array.from(finalApiRuntime.store.workflowAudits.keys()))
  const parse = await executeFinalApiTool('parseActivityRules', {
    name: 'Agent Chat Run Console 审计',
    platform: 'tmall',
    sourceText: '库存不得低于 40 件。',
  })
  assert.equal(parse.status, 'SUCCEEDED')
  const audit = Array.from(finalApiRuntime.store.workflowAudits.entries())
    .filter(([workflowRunId]) => !beforeIds.has(workflowRunId))
    .map(([, value]) => value)
    .find((item) => item.workflowType === 'activity_rule_parse')
  assert.ok(audit)

  const execution = await executeFinalApiTool('listRunConsole', { pageSize: 20, type: 'activity_rule_parse' })
  assert.equal(execution.status, 'SUCCEEDED')
  const result = execution.result as { items: Array<{ runId: string; type: string; sourceId?: string }> }
  assert.ok(result.items.some((item) => item.runId === audit.workflowRunId && item.type === 'activity_rule_parse' && item.sourceId === audit.subjectId))
})

test('agent chat updateRuleSet tool persists status-only updates', async () => {
  const created = await executeFinalApiTool('createRuleSet', {
    name: 'Agent Chat 状态更新规则集',
    platform: 'tmall',
    sourceText: '库存不得低于 20 件。',
    status: 'DRAFT',
  })
  assert.equal(created.status, 'SUCCEEDED')

  const ruleSetId = (created.result as { ruleSetId: string }).ruleSetId
  const updated = await executeFinalApiTool('updateRuleSet', {
    ruleSetId,
    status: 'DISABLED',
  })
  assert.equal(updated.status, 'SUCCEEDED')
  assert.equal((updated.result as { status: string }).status, 'DISABLED')

  const detail = await finalApiRuntime.ruleSetService.get(ruleSetId)
  assert.equal(detail?.status, 'DISABLED')
})

test('agent chat settings tools read and update real workspace settings', async () => {
  const read = await executeFinalApiTool('getWorkspaceSettings', {})
  assert.equal(read.status, 'SUCCEEDED')
  const workspace = (read.result as { workspace: { dataFreshnessThresholdHours: number }; toolPolicy: { allowedAgentTools: string[] }; users: Array<{ userId: string }> }).workspace
  assert.ok(workspace.dataFreshnessThresholdHours > 0)

  const updatedWorkspace = await executeFinalApiTool('updateWorkspaceSettings', { dataFreshnessThresholdHours: 18 })
  assert.equal(updatedWorkspace.status, 'SUCCEEDED')
  assert.equal((updatedWorkspace.result as { dataFreshnessThresholdHours: number }).dataFreshnessThresholdHours, 18)

  const policy = await executeFinalApiTool('getToolPolicy', {})
  assert.equal(policy.status, 'SUCCEEDED')
  const allowedAgentTools = (policy.result as { allowedAgentTools: string[] }).allowedAgentTools
  assert.ok(allowedAgentTools.includes('getWorkspaceSettings'))

  const updatedPolicy = await executeFinalApiTool('updateToolPolicy', { allowedAgentTools, deniedRuntimeTools: ['customRuntimeDeniedByAgentTest'] })
  assert.equal(updatedPolicy.status, 'SUCCEEDED')
  assert.ok((updatedPolicy.result as { deniedRuntimeTools: string[] }).deniedRuntimeTools.includes('customRuntimeDeniedByAgentTest'))

  const users = await executeFinalApiTool('listSettingsUsers', {})
  assert.equal(users.status, 'SUCCEEDED')
  assert.ok((users.result as Array<{ userId: string }>).some((user) => user.userId === 'qa_reviewer'))

  const updatedUser = await executeFinalApiTool('updateSettingsUserStatus', { userId: 'qa_reviewer', status: 'ACTIVE' })
  assert.equal(updatedUser.status, 'SUCCEEDED')
  assert.equal((updatedUser.result as { userId: string; status: string }).status, 'ACTIVE')
})

test('agent chat ingestSkus tool writes SKU projections that can be read back', async () => {
  const externalSkuId = `agent_ingest_sku_${Date.now()}`
  const execution = await executeFinalApiTool('ingestSkus', {
    connectorId: 'agent_ingest_connector',
    collectedAt: '2026-05-26T10:00:00.000Z',
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_store',
        externalSkuId,
        productName: 'Agent 写入测试 SKU',
        category: '测试类目',
        sales30d: 128,
        positiveRate: 0.98,
        stock: 66,
        certificateStatus: 'VALID',
      },
    ],
  })

  assert.equal(execution.status, 'SUCCEEDED')
  const summary = (execution.result as { summaries: Array<{ skuProfileId: string; canonicalSkuKey: string }> }).summaries[0]
  assert.ok(summary?.skuProfileId)
  assert.equal(summary.canonicalSkuKey, `tmall:agent_store:${externalSkuId}`)

  const detail = await finalApiRuntime.ingestService.getSkuDetail(summary.skuProfileId)
  assert.equal(detail?.productName, 'Agent 写入测试 SKU')
  assert.equal(detail?.latestSnapshot?.stock, 66)
})

test('agent chat ingestBrowserScan tool writes browser scan rows to SKU projections', async () => {
  const externalSkuId = `agent_browser_scan_${Date.now()}`
  const execution = await executeFinalApiTool('ingestBrowserScan', {
    url: 'https://tmall.example.test/sku-list',
    storeId: 'agent_browser_store',
    rows: [
      {
        sku: externalSkuId,
        title: 'Agent 浏览器扫描 SKU',
        stock: 51,
        sales: 236,
        positiveRate: 0.96,
      },
    ],
  })

  assert.equal(execution.status, 'SUCCEEDED')
  const summary = (execution.result as { ingest: { summaries: Array<{ skuProfileId: string; canonicalSkuKey: string }> } }).ingest.summaries[0]
  assert.equal(summary.canonicalSkuKey, `tmall:agent_browser_store:${externalSkuId}`)

  const detail = await finalApiRuntime.ingestService.getSkuDetail(summary.skuProfileId)
  assert.equal(detail?.productName, 'Agent 浏览器扫描 SKU')
  assert.equal(detail?.latestSnapshot?.stock, 51)
})

test('agent chat ingestBrowserScan tool rejects preview rows that are not ingest ready', async () => {
  const execution = await executeFinalApiTool('ingestBrowserScan', {
    url: 'https://unknown.example.test/list',
    storeId: 'agent_browser_store',
    rows: [{ sku: `agent_browser_reject_${Date.now()}`, title: '不支持页面 SKU', stock: 1 }],
  })

  assert.equal(execution.status, 'FAILED')
  assert.match((execution.result as { message?: string }).message ?? '', /not ingest ready/)
})

test('agent chat retryRun tool supports activity simulation retries', async () => {
  const skuExternalId = `agent_retry_simulation_sku_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_retry_store',
        externalSkuId: skuExternalId,
        productName: 'Agent 模拟重试 SKU',
        stock: 88,
        positiveRate: 0.99,
        certificateStatus: 'VALID',
      },
    ],
  })
  assert.equal(ingest.status, 'SUCCEEDED')
  const skuProfileId = (ingest.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0]?.skuProfileId
  assert.ok(skuProfileId)

  const ruleSet = await executeFinalApiTool('createRuleSet', {
    name: 'Agent 模拟重试规则集',
    platform: 'tmall',
    sourceText: '库存不得低于 20 件。',
    status: 'ENABLED',
  })
  assert.equal(ruleSet.status, 'SUCCEEDED')
  const ruleSetId = (ruleSet.result as { ruleSetId: string }).ruleSetId

  const retry = await executeFinalApiTool('retryRun', {
    runType: 'activity_simulation',
    sourceId: ruleSetId,
    runId: 'failed_simulation_run_for_agent_test',
    skuProfileIds: [skuProfileId],
  })

  assert.equal(retry.status, 'SUCCEEDED')
  const result = retry.result as { simulationRunId: string; results: Array<{ skuProfileId: string }> }
  assert.ok(result.simulationRunId)
  assert.deepEqual(result.results.map((item) => item.skuProfileId), [skuProfileId])
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
  assert.equal(agentToolRiskLevel('createReviewItems'), 'L1')
  assert.equal(agentToolRiskLevel('runConnectorSync'), 'L1')
  assert.equal(agentToolRiskLevel('setSkuNextAction'), 'L1')
  assert.equal(agentToolRiskLevel('exportReport'), 'L1')
  assert.equal(agentToolRiskLevel('subscribeReport'), 'L1')
  assert.equal(agentToolRiskLevel('answerAgentRunQuestion'), 'L1')
  assert.equal(agentToolRiskLevel('getWorkspaceSettings'), 'L1')
  assert.equal(agentToolRiskLevel('updateWorkspaceSettings'), 'L2')
  assert.equal(agentToolRiskLevel('updateToolPolicy'), 'L2')
  assert.equal(agentToolRiskLevel('updateSettingsUserStatus'), 'L2')
  assert.equal(agentToolRequiresReviewGate('generateReport'), true)
  assert.equal(agentToolRequiresReviewGate('generateReportPreview'), true)
  assert.equal(agentToolRequiresReviewGate('reportPreview'), true)
  assert.equal(agentToolRequiresReviewGate('getReportDetail'), false)
  assert.equal(agentToolRequiresReviewGate('createReviewItems'), false)
  assert.equal(agentToolRequiresReviewGate('runConnectorSync'), false)
  assert.equal(agentToolRequiresReviewGate('setSkuNextAction'), false)
  assert.equal(agentToolRequiresReviewGate('exportReport'), false)
  assert.equal(agentToolRequiresReviewGate('subscribeReport'), false)
  assert.equal(agentToolRequiresReviewGate('answerAgentRunQuestion'), false)
  assert.equal(agentToolRequiresReviewGate('getWorkspaceSettings'), false)
  assert.equal(agentToolRequiresReviewGate('updateWorkspaceSettings'), true)
  assert.equal(agentToolRequiresReviewGate('updateToolPolicy'), true)
  assert.equal(agentToolRequiresReviewGate('updateSettingsUserStatus'), true)
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

test('agent chat persistent executor directly executes low-risk audited product tools', async () => {
  const beforeReviewCount = finalApiRuntime.store.reviews.size
  const calls: Array<{ kind: string; input: Record<string, unknown> }> = []
  const repository = {
    createToolCall: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'toolCall', input })
      return { id: 'tool_call_low_risk_1', ...input }
    },
    createReviewGate: async () => {
      throw new Error('low-risk tool should not open review gate')
    },
    appendRunEvent: async (input: Record<string, unknown>) => {
      calls.push({ kind: 'event', input })
      return { id: 'event_low_risk_1', ...input }
    },
  }

  const executor = createPersistentToolExecutor(repository as never)
  const execution = await executor({
    run: { id: 'run_low_risk_1' } as never,
    mission: { id: 'mission_low_risk_1' } as never,
    toolName: 'createReviewItems',
    inputJson: {
      sourceId: 'agent_low_risk_source',
      question: '是否需要补充证据后再推进？',
      recommendation: '提交人工复核并保留证据链。',
      riskLevel: 'L1',
    },
  })

  assert.equal(execution.status, 'SUCCEEDED')
  assert.equal(execution.toolCall.reviewPolicy, 'AUTO_ALLOW')
  assert.equal(execution.toolCall.riskLevel, 'L1')
  assert.equal(finalApiRuntime.store.reviews.size, beforeReviewCount + 1)
  assert.deepEqual(calls.map((item) => item.kind), ['toolCall', 'event'])
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
  await finalReportSnapshotRequest
  const skuProfileId = Array.from(finalApiRuntime.store.projections.keys())[0]
  assert.ok(skuProfileId)
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
      inputJson: { skuProfileIds: [skuProfileId] },
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
