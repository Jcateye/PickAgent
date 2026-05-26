import assert from 'node:assert/strict'
import test from 'node:test'

import { agentToolRequiresReviewGate, agentToolRiskLevel, createPersistentToolExecutor, executeFinalApiTool, isAgentToolDeniedBySettings, linkedEntityHref, POST } from '../src/app/api/agent/chat/route'
import { executeApprovedChatReviewGateTool } from '../src/app/api/agent/review-gates/[gateId]/decision/route'
import { toRecoveredTurn } from '../src/app/api/agent/sessions/recovered-turn'
import { finalApiRuntime, finalReportSnapshotRequest } from '../src/app/api/_final-api-runtime'

test('agent chat linked entities route back to the new workbench pages', () => {
  assert.equal(linkedEntityHref('sku_profile', 'sku_1'), '/sku-access?skuProfileId=sku_1&drawerTab=evidence')
  assert.equal(linkedEntityHref('activity', 'activity_1'), '/rule-execution?activityId=activity_1')
  assert.equal(linkedEntityHref('rule_set', 'rule_1'), '/rule-library?ruleSetId=rule_1')
  assert.equal(linkedEntityHref('review_item', 'review_1'), '/review-approvals?reviewItemId=review_1')
  assert.equal(linkedEntityHref('report', 'report_1'), '/report-center?reportId=report_1')
  assert.equal(linkedEntityHref('connector', 'connector_1'), '/data-sources?connectorId=connector_1')
  assert.equal(linkedEntityHref('agent_mission', 'mission_1'), '/agent-mission?missionId=mission_1')
  assert.equal(linkedEntityHref('simulation_run', 'rule_1:run_1'), '/rule-execution?simulationRunId=run_1&ruleSetId=rule_1')
  assert.equal(linkedEntityHref('dashboard', 'connectors'), '/data-sources')
  assert.equal(linkedEntityHref('dashboard', 'reports'), '/report-center')
  assert.equal(linkedEntityHref('dashboard', 'reviews'), '/review-approvals')
  assert.equal(linkedEntityHref('dashboard', 'rule-sets'), '/rule-library')
  assert.equal(linkedEntityHref('dashboard', 'agent-missions'), '/agent-mission')
  assert.equal(linkedEntityHref('download_artifact', '/api/skus/export/download?page=1'), '/api/skus/export/download?page=1')
})

test('agent chat mission tools link back to the mission console', async () => {
  const created = await executeFinalApiTool('createAgentMission', {
    sessionKey: `agent-mission-link-${Date.now()}`,
    objective: '验证 Agent Mission 深链',
    sourceSurface: 'agent-chat-test',
  })
  assert.equal(created.status, 'SUCCEEDED')
  assert.equal(created.linkedEntity?.type, 'agent_mission')
  const missionId = (created.result as { mission: { id: string } }).mission.id
  assert.equal(created.linkedEntity.id, missionId)
  assert.equal(linkedEntityHref(created.linkedEntity.type, created.linkedEntity.id), `/agent-mission?missionId=${missionId}`)
})

test('agent chat connector linked entities restore data source details', async () => {
  const code = `agent_connector_link_${Date.now()}`
  const created = await executeFinalApiTool('createConnector', {
    name: 'Agent 连接器深链验证',
    code,
    connectorKind: 'browser_extension',
    platform: 'tmall',
    status: 'ACTIVE',
    config: { source: 'agent-chat-test' },
  })
  assert.equal(created.status, 'SUCCEEDED')
  assert.equal(created.linkedEntity?.type, 'connector')
  const connectorId = (created.result as { connectorId: string }).connectorId
  assert.equal(created.linkedEntity.id, connectorId)
  assert.equal(linkedEntityHref(created.linkedEntity.type, created.linkedEntity.id), `/data-sources?connectorId=${connectorId}`)
})

test('agent chat activity simulation links back to restorable rule execution results', async () => {
  const ingested = await executeFinalApiTool('ingestSkus', {
    rows: [{
      platform: 'tmall',
      storeId: 'agent_simulation_link_store',
      externalSkuId: `agent_simulation_link_${Date.now()}`,
      productName: 'Agent 模拟深链 SKU',
      stock: 5,
      positiveRate: 0.98,
      certificateStatus: 'valid',
    }],
  })
  assert.equal(ingested.status, 'SUCCEEDED')
  const skuProfileId = (ingested.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0]?.skuProfileId
  assert.ok(skuProfileId)

  const parsed = await executeFinalApiTool('parseActivityRules', {
    name: 'Agent 模拟深链规则',
    platform: 'tmall',
    sourceText: '库存不得低于 10 件。',
  })
  assert.equal(parsed.status, 'SUCCEEDED')
  const ruleSetId = (parsed.result as { ruleSetId: string }).ruleSetId

  const simulated = await executeFinalApiTool('simulateActivityReadiness', { ruleSetId, skuProfileIds: [skuProfileId] })
  assert.equal(simulated.status, 'SUCCEEDED')
  const simulationRunId = (simulated.result as { simulationRunId: string }).simulationRunId
  assert.ok(simulationRunId)
  assert.equal(simulated.linkedEntity?.type, 'simulation_run')
  assert.equal(linkedEntityHref(simulated.linkedEntity.type, simulated.linkedEntity.id), `/rule-execution?simulationRunId=${simulationRunId}&ruleSetId=${ruleSetId}`)
})

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

test('agent chat getHealthSummary tool reads real dashboard health totals', async () => {
  const externalSkuId = `agent_health_summary_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [{
      platform: 'tmall',
      storeId: 'agent_health_summary_store',
      externalSkuId,
      productName: 'Agent 健康汇总 SKU',
      stock: 20,
      positiveRate: 0.98,
    }],
  })
  assert.equal(ingest.status, 'SUCCEEDED')

  const summary = await executeFinalApiTool('getHealthSummary', {})
  assert.equal(summary.status, 'SUCCEEDED')
  assert.ok((summary.result as { total: number }).total >= 1)
  assert.equal(summary.linkedEntity?.type, 'dashboard')
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

test('agent chat exportRunLogs tool returns backend run log content', async () => {
  const beforeIds = new Set(Array.from(finalApiRuntime.store.workflowAudits.keys()))
  const parse = await executeFinalApiTool('parseActivityRules', {
    name: 'Agent Chat Run 日志导出',
    platform: 'tmall',
    sourceText: '库存不得低于 45 件。',
  })
  assert.equal(parse.status, 'SUCCEEDED')
  const audit = Array.from(finalApiRuntime.store.workflowAudits.entries())
    .filter(([workflowRunId]) => !beforeIds.has(workflowRunId))
    .map(([, value]) => value)
    .find((item) => item.workflowType === 'activity_rule_parse')
  assert.ok(audit)

  const execution = await executeFinalApiTool('exportRunLogs', { runId: audit.workflowRunId })
  assert.equal(execution.status, 'SUCCEEDED')
  const exported = execution.result as { runId: string; content: string; lineCount: number }
  assert.equal(exported.runId, audit.workflowRunId)
  assert.match(exported.content, /activity_rule_parse/)
  assert.ok(exported.lineCount >= 5)
  assert.equal(execution.linkedEntity?.type, 'workflow_run')
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
  assert.equal(updated.linkedEntity?.type, 'workflow_run')
  assert.ok((updated.result as { workflowRunId?: string }).workflowRunId)

  const detail = await finalApiRuntime.ruleSetService.get(ruleSetId)
  assert.equal(detail?.status, 'DISABLED')
})

test('agent chat listRuleSetVersions tool reads persisted rule set versions', async () => {
  const created = await executeFinalApiTool('createRuleSet', {
    name: 'Agent Chat 版本历史规则集',
    platform: 'tmall',
    sourceText: '库存不得低于 20 件。',
    status: 'ENABLED',
  })
  assert.equal(created.status, 'SUCCEEDED')

  const ruleSetId = (created.result as { ruleSetId: string }).ruleSetId
  const version = await executeFinalApiTool('createRuleSetVersion', { ruleSetId })
  assert.equal(version.status, 'SUCCEEDED')
  assert.equal(version.linkedEntity?.type, 'workflow_run')
  const ruleSetVersionId = (version.result as { ruleSetVersionId: string }).ruleSetVersionId

  const listed = await executeFinalApiTool('listRuleSetVersions', { ruleSetId })
  assert.equal(listed.status, 'SUCCEEDED')
  const result = listed.result as { items: Array<{ ruleSetVersionId: string; ruleSetId: string }>; total: number }
  assert.ok(result.total >= 1)
  assert.ok(result.items.some((item) => item.ruleSetVersionId === ruleSetVersionId && item.ruleSetId === ruleSetId))
  assert.equal(listed.linkedEntity?.type, 'rule_set')
  assert.equal(listed.linkedEntity?.id, ruleSetId)
})

test('agent chat settings tools read and update real workspace settings', async () => {
  const read = await executeFinalApiTool('getWorkspaceSettings', {})
  assert.equal(read.status, 'SUCCEEDED')
  const workspace = (read.result as { workspace: { dataFreshnessThresholdHours: number }; toolPolicy: { allowedAgentTools: string[] }; users: Array<{ userId: string }> }).workspace
  assert.ok(workspace.dataFreshnessThresholdHours > 0)

  const updatedWorkspace = await executeFinalApiTool('updateWorkspaceSettings', { dataFreshnessThresholdHours: 18 })
  assert.equal(updatedWorkspace.status, 'SUCCEEDED')
  assert.equal((updatedWorkspace.result as { dataFreshnessThresholdHours: number }).dataFreshnessThresholdHours, 18)
  assert.equal(updatedWorkspace.linkedEntity?.type, 'workflow_run')

  const policy = await executeFinalApiTool('getToolPolicy', {})
  assert.equal(policy.status, 'SUCCEEDED')
  const allowedAgentTools = (policy.result as { allowedAgentTools: string[] }).allowedAgentTools
  assert.ok(allowedAgentTools.includes('getWorkspaceSettings'))

  const updatedPolicy = await executeFinalApiTool('updateToolPolicy', { allowedAgentTools, deniedRuntimeTools: ['customRuntimeDeniedByAgentTest'] })
  assert.equal(updatedPolicy.status, 'SUCCEEDED')
  assert.ok((updatedPolicy.result as { deniedRuntimeTools: string[] }).deniedRuntimeTools.includes('customRuntimeDeniedByAgentTest'))
  assert.equal(updatedPolicy.linkedEntity?.type, 'workflow_run')

  const users = await executeFinalApiTool('listSettingsUsers', {})
  assert.equal(users.status, 'SUCCEEDED')
  assert.ok((users.result as Array<{ userId: string }>).some((user) => user.userId === 'qa_reviewer'))

  const updatedUser = await executeFinalApiTool('updateSettingsUserStatus', { userId: 'qa_reviewer', status: 'ACTIVE' })
  assert.equal(updatedUser.status, 'SUCCEEDED')
  assert.equal((updatedUser.result as { userId: string; status: string }).status, 'ACTIVE')
  assert.equal(updatedUser.linkedEntity?.type, 'workflow_run')
})

test('agent chat createReviewItems tool supports batch simulation review creation', async () => {
  const first = await executeFinalApiTool('ingestSkus', {
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_batch_review_store',
        externalSkuId: `agent_batch_review_1_${Date.now()}`,
        productName: 'Agent 批量 Review SKU 1',
        stock: 3,
        positiveRate: 0.8,
      },
      {
        platform: 'tmall',
        storeId: 'agent_batch_review_store',
        externalSkuId: `agent_batch_review_2_${Date.now()}`,
        productName: 'Agent 批量 Review SKU 2',
        stock: 4,
        positiveRate: 0.82,
      },
    ],
  })
  assert.equal(first.status, 'SUCCEEDED')
  const skuProfileIds = (first.result as { summaries: Array<{ skuProfileId: string }> }).summaries.map((item) => item.skuProfileId)

  const created = await executeFinalApiTool('createReviewItems', {
    items: skuProfileIds.map((skuProfileId, index) => ({
      skuProfileId,
      sourceType: 'simulation',
      sourceId: `simulation_result_batch_${index}`,
      question: `确认模拟失败 SKU ${index + 1}`,
      recommendation: '先人工确认活动上下文再重跑模拟。',
      riskLevel: 'L2',
      evidence: [{ type: 'simulation', entityId: `simulation_result_batch_${index}`, label: '模拟结果', summary: '准入模拟需要人工确认' }],
    })),
  })

  assert.equal(created.status, 'SUCCEEDED')
  const reviews = created.result as Array<{ reviewItemId: string; sourceType: string; skuProfileId?: string; status: string }>
  assert.equal(reviews.length, 2)
  assert.ok(reviews.every((item) => item.status === 'OPEN' && item.sourceType === 'simulation'))

  const detail = await finalApiRuntime.skuReadinessQueryService.detail(skuProfileIds[0], {
    actorId: 'agent_demo',
    tenantId: 'dev_tenant',
    sessionId: 'agent_tool_session',
    surface: 'agent-chat-tool',
    requestId: 'agent_tool_request',
  })
  assert.ok(detail?.relatedReviews.some((item) => item.entityId === reviews[0].reviewItemId))
})

test('agent chat listReviews tool reads pending review queues', async () => {
  const created = await executeFinalApiTool('createReviewItems', {
    items: [
      {
        sourceType: 'agent',
        sourceId: `agent_review_list_${Date.now()}`,
        question: '是否需要人工确认 Agent 列表测试项？',
        recommendation: '进入人工 Review 队列。',
        riskLevel: 'L2',
        evidence: [{ type: 'tool_trace', entityId: 'agent_review_list', label: '列表测试', summary: '用于验证 listReviews 工具' }],
      },
    ],
  })
  assert.equal(created.status, 'SUCCEEDED')
  const reviewItemId = (created.result as Array<{ reviewItemId: string }>)[0].reviewItemId

  const listed = await executeFinalApiTool('listReviews', {
    tab: 'PENDING',
    reviewRiskLevel: 'HIGH',
    q: '人工确认 Agent 列表测试项',
  })
  assert.equal(listed.status, 'SUCCEEDED')
  const result = listed.result as { items: Array<{ reviewItemId: string; status: string; riskLevel: string }> }
  assert.ok(result.items.some((item) => item.reviewItemId === reviewItemId && item.status === 'PENDING' && item.riskLevel === 'HIGH'))
  assert.equal(listed.linkedEntity?.type, 'review_item')
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
  const result = retry.result as { simulationRunId: string; workflowRunId?: string; results: Array<{ skuProfileId: string }> }
  assert.ok(result.simulationRunId)
  assert.ok(result.workflowRunId)
  assert.equal(retry.linkedEntity?.type, 'workflow_run')
  assert.equal(retry.linkedEntity?.id, result.workflowRunId)
  assert.ok(retry.linkedEntities?.some((entity) => entity.type === 'simulation_run' && entity.id === `${ruleSetId}:${result.simulationRunId}`))
  assert.deepEqual(result.results.map((item) => item.skuProfileId), [skuProfileId])
})

test('agent chat setSkuNextAction links audited run and sku object', async () => {
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_next_action_store',
        externalSkuId: `agent_next_action_${Date.now()}`,
        productName: 'Agent 下一步设置 SKU',
        stock: 18,
        positiveRate: 0.95,
      },
    ],
  })
  assert.equal(ingest.status, 'SUCCEEDED')
  const skuProfileId = (ingest.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0]?.skuProfileId
  assert.ok(skuProfileId)

  const updated = await executeFinalApiTool('setSkuNextAction', {
    skuProfileId,
    type: 'MANUAL_REVIEW',
    label: '提交人工确认',
  })
  assert.equal(updated.status, 'SUCCEEDED')
  const result = updated.result as { workflowRunId?: string; statusSummary: { nextStep: string } }
  assert.equal(result.statusSummary.nextStep, '提交人工确认')
  assert.ok(result.workflowRunId)
  assert.equal(updated.linkedEntity?.type, 'workflow_run')
  assert.equal(updated.linkedEntity?.id, result.workflowRunId)
  assert.ok(updated.linkedEntities?.some((entity) => entity.type === 'sku_profile' && entity.id === skuProfileId))
})

test('agent chat reads connector run and activity simulation run details', async () => {
  const connector = await executeFinalApiTool('createConnector', {
    name: 'Agent 运行详情连接器',
    code: `agent_run_detail_connector_${Date.now()}`,
    connectorKind: 'platform_api',
    platform: 'tmall',
  })
  assert.equal(connector.status, 'SUCCEEDED')
  const connectorId = (connector.result as { connectorId: string }).connectorId
  const connectorRun = await executeFinalApiTool('runConnectorSync', {
    connectorId,
    rowCount: 17,
    qualityScore: 0.91,
    warnings: ['agent detail test'],
  })
  assert.equal(connectorRun.status, 'SUCCEEDED')
  assert.equal(connectorRun.linkedEntity?.type, 'workflow_run')
  const connectorRunResult = connectorRun.result as { connectorRunId: string; workflowRunRef?: { entityId: string } }
  const connectorRunId = connectorRunResult.connectorRunId
  assert.ok(connectorRunResult.workflowRunRef?.entityId)
  assert.equal(connectorRun.linkedEntity.id, connectorRunResult.workflowRunRef.entityId)
  assert.ok(connectorRun.linkedEntities?.some((entity) => entity.type === 'connector' && entity.id === connectorId))
  assert.ok(connectorRun.linkedEntities?.some((entity) => entity.type === 'workflow_run' && entity.id === connectorRunResult.workflowRunRef?.entityId))
  const connectorRetry = await executeFinalApiTool('retryRun', {
    runType: 'connector_sync',
    sourceId: connectorId,
    runId: connectorRunResult.workflowRunRef.entityId,
    rowCount: 18,
    qualityScore: 0.9,
  })
  assert.equal(connectorRetry.status, 'SUCCEEDED')
  assert.equal(connectorRetry.linkedEntity?.type, 'workflow_run')
  assert.ok((connectorRetry.result as { workflowRunRef?: { entityId: string } }).workflowRunRef?.entityId)
  const connectorRuns = await executeFinalApiTool('listConnectorRuns', { connectorId, pageSize: 5 })
  assert.equal(connectorRuns.status, 'SUCCEEDED')
  assert.ok((connectorRuns.result as { items: Array<{ connectorRunId: string }> }).items.some((item) => item.connectorRunId === connectorRunId))
  const connectorRunDetail = await executeFinalApiTool('getConnectorRunDetail', { connectorRunId })
  assert.equal(connectorRunDetail.status, 'SUCCEEDED')
  assert.equal((connectorRunDetail.result as { connectorRunId: string; rowCount: number }).connectorRunId, connectorRunId)
  assert.equal((connectorRunDetail.result as { rowCount: number }).rowCount, 17)

  const skuExternalId = `agent_sim_detail_sku_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [{
      platform: 'tmall',
      storeId: 'agent_sim_detail_store',
      externalSkuId: skuExternalId,
      productName: 'Agent 模拟详情 SKU',
      stock: 80,
      positiveRate: 0.99,
      certificateStatus: 'VALID',
    }],
  })
  assert.equal(ingest.status, 'SUCCEEDED')
  const skuProfileId = (ingest.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0].skuProfileId
  const activity = await finalApiRuntime.activityService.create({ name: 'Agent 模拟详情活动', platform: 'tmall' })
  await finalApiRuntime.activityService.parseForActivity(activity.activityId, {
    sourceText: '库存不得低于 20 件。',
  })
  const simulation = await finalApiRuntime.activityService.simulateForActivity(activity.activityId, { skuProfileIds: [skuProfileId] })

  const simulationDetail = await executeFinalApiTool('getActivitySimulationRunDetail', {
    activityId: activity.activityId,
    simulationRunId: simulation.simulationRunId,
  })
  assert.equal(simulationDetail.status, 'SUCCEEDED')
  const detail = simulationDetail.result as { simulationRunId: string; results: Array<{ skuProfileId: string }> }
  assert.equal(detail.simulationRunId, simulation.simulationRunId)
  assert.deepEqual(detail.results.map((item) => item.skuProfileId), [skuProfileId])

  const ruleSet = await executeFinalApiTool('createRuleSet', {
    name: 'Agent 规则执行详情规则',
    sourceText: '库存不得低于 20 件。',
    platform: 'tmall',
    status: 'ENABLED',
  })
  assert.equal(ruleSet.status, 'SUCCEEDED')
  const ruleSetId = (ruleSet.result as { ruleSetId: string }).ruleSetId
  const ruleSetSimulation = await executeFinalApiTool('simulateActivityReadiness', {
    ruleSetId,
    skuProfileIds: [skuProfileId],
  })
  assert.equal(ruleSetSimulation.status, 'SUCCEEDED')
  const ruleSetSimulationRunId = (ruleSetSimulation.result as { simulationRunId: string }).simulationRunId

  const ruleSetSimulationDetail = await executeFinalApiTool('getActivitySimulationRunDetail', {
    ruleSetId,
    simulationRunId: ruleSetSimulationRunId,
  })
  assert.equal(ruleSetSimulationDetail.status, 'SUCCEEDED')
  const ruleSetDetail = ruleSetSimulationDetail.result as { simulationRunId: string; activityRuleSetId: string; results: Array<{ skuProfileId: string }> }
  assert.equal(ruleSetDetail.simulationRunId, ruleSetSimulationRunId)
  assert.equal(ruleSetDetail.activityRuleSetId, ruleSetId)
  assert.deepEqual(ruleSetDetail.results.map((item) => item.skuProfileId), [skuProfileId])
})

test('agent chat exportSkuList tool creates auditable sku csv export', async () => {
  const externalSkuId = `agent_export_sku_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_export_store',
        externalSkuId,
        productName: 'Agent 导出 SKU',
        stock: 31,
        positiveRate: 0.98,
      },
    ],
  })
  assert.equal(ingest.status, 'SUCCEEDED')

  const execution = await executeFinalApiTool('exportSkuList', {
    q: externalSkuId,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })

  assert.equal(execution.status, 'SUCCEEDED')
  const result = execution.result as { csv: string; rowCount: number; workflowRunId?: string }
  assert.equal(result.rowCount, 1)
  assert.match(result.csv, /skuProfileId,displaySku,productName/)
  assert.ok(result.workflowRunId)
  assert.match((result as { artifactHref?: string }).artifactHref ?? '', /\/api\/skus\/export\/download\?/)
  assert.equal(execution.linkedEntity?.type, 'workflow_run')
  assert.ok(execution.linkedEntities?.some((entity) => entity.type === 'download_artifact' && entity.id === (result as { artifactHref?: string }).artifactHref))
  assert.ok(execution.linkedEntities?.some((entity) => entity.type === 'workflow_run' && entity.id === result.workflowRunId))
})

test('agent chat audited report and review write tools link to run console', async () => {
  const externalSkuId = `agent_write_run_link_sku_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [{
      platform: 'tmall',
      storeId: 'agent_write_run_link_store',
      externalSkuId,
      productName: 'Agent 写操作 Run 链接 SKU',
      stock: 38,
      positiveRate: 0.98,
    }],
  })
  assert.equal(ingest.status, 'SUCCEEDED')
  const skuProfileId = (ingest.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0].skuProfileId

  const generated = await executeFinalApiTool('generateReport', { type: 'HEALTH', skuProfileIds: [skuProfileId] })
  assert.equal(generated.status, 'SUCCEEDED')
  const generatedResult = generated.result as { reportId: string; workflowRunId?: string }
  const reportId = generatedResult.reportId
  assert.equal(generated.linkedEntity?.type, 'report')
  assert.ok(generatedResult.workflowRunId)
  assert.ok(generated.linkedEntities?.some((entity) => entity.type === 'report' && entity.id === reportId))
  assert.ok(generated.linkedEntities?.some((entity) => entity.type === 'workflow_run' && entity.id === generatedResult.workflowRunId))

  const exported = await executeFinalApiTool('exportReport', { reportId, format: 'PDF' })
  assert.equal(exported.status, 'SUCCEEDED')
  assert.equal(exported.linkedEntity?.type, 'workflow_run')
  const exportedResult = exported.result as { workflowRunId?: string; artifactHref?: string }
  assert.ok(exportedResult.workflowRunId)
  assert.match(exportedResult.artifactHref ?? '', new RegExp(`/api/reports/${reportId}/download\\\\?`))
  assert.ok(exported.linkedEntities?.some((entity) => entity.type === 'download_artifact' && entity.id === exportedResult.artifactHref))
  assert.ok(exported.linkedEntities?.some((entity) => entity.type === 'workflow_run' && entity.id === exportedResult.workflowRunId))

  const createdReviews = await executeFinalApiTool('createReviewItems', {
    items: [{
      skuProfileId,
      sourceType: 'health',
      sourceId: skuProfileId,
      question: '确认 Agent 写操作 Run 链接',
      recommendation: '用于验证 Chat Review 工具回链到 Run Console。',
      riskLevel: 'L1',
      evidence: [{ type: 'tool_trace', entityId: skuProfileId, label: 'SKU 证据', summary: 'Agent test evidence' }],
    }],
  })
  assert.equal(createdReviews.status, 'SUCCEEDED')
  const reviewItemId = (createdReviews.result as Array<{ reviewItemId: string }>)[0].reviewItemId

  const updatedReview = await executeFinalApiTool('updateReviewItem', { reviewItemId, recommendation: '已补充建议内容' })
  assert.equal(updatedReview.status, 'SUCCEEDED')
  assert.equal(updatedReview.linkedEntity?.type, 'workflow_run')

  const decidedReview = await executeFinalApiTool('decideReviewItem', { reviewItemId, decision: 'APPROVE', decisionBy: 'agent-test' })
  assert.equal(decidedReview.status, 'SUCCEEDED')
  assert.equal(decidedReview.linkedEntity?.type, 'workflow_run')
})

test('agent chat generateReportPreview tool aliases to the real report generator', async () => {
  const externalSkuId = `agent_report_preview_sku_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_report_preview_store',
        externalSkuId,
        productName: 'Agent 报告预览 SKU',
        stock: 28,
        positiveRate: 0.97,
      },
    ],
  })
  assert.equal(ingest.status, 'SUCCEEDED')
  const skuProfileId = (ingest.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0]?.skuProfileId

  const execution = await executeFinalApiTool('generateReportPreview', {
    type: 'HEALTH',
    skuProfileIds: [skuProfileId],
  })

  assert.equal(execution.status, 'SUCCEEDED')
  const result = execution.result as { reportId: string; title: string }
  assert.ok(result.reportId)
  assert.match(result.title, /健康|活动|报告/)
  assert.equal(execution.linkedEntity?.type, 'report')
  const detail = await finalApiRuntime.reportService.getDetail(result.reportId)
  assert.equal(detail?.summary.totalSku, 1)
})

test('agent chat sku query tools support page-level advanced filters', async () => {
  const externalSkuId = `agent_filter_sku_${Date.now()}`
  const ingest = await executeFinalApiTool('ingestSkus', {
    rows: [
      {
        platform: 'tmall',
        storeId: 'agent_filter_store',
        externalSkuId,
        productName: 'Agent 高级筛选 SKU',
        category: 'seasonal',
        stock: 44,
        positiveRate: 0.99,
        certificateStatus: 'VALID',
      },
    ],
  })
  assert.equal(ingest.status, 'SUCCEEDED')
  const skuProfileId = (ingest.result as { summaries: Array<{ skuProfileId: string }> }).summaries[0]?.skuProfileId
  const baseline = await executeFinalApiTool('searchSkus', { q: externalSkuId, pageSize: 1 })
  assert.equal(baseline.status, 'SUCCEEDED')
  const baselineItem = (baseline.result as { items: Array<{ category?: string; healthStatus: string; sourceKind?: string }> }).items[0]
  assert.ok(baselineItem)

  const search = await executeFinalApiTool('searchSkus', {
    platforms: ['tmall'],
    categories: [baselineItem.category ?? 'seasonal'],
    healthStatuses: [baselineItem.healthStatus],
    certificateStatuses: ['VALID'],
    sourceKinds: baselineItem.sourceKind ? [baselineItem.sourceKind] : undefined,
    minStock: 40,
    maxStock: 50,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })
  assert.equal(search.status, 'SUCCEEDED')
  const searchResult = search.result as { query: { platforms?: string[]; categories?: string[]; sourceKinds?: string[] }; items: Array<{ skuProfileId: string }> }
  assert.deepEqual(searchResult.query.platforms, ['tmall'])
  assert.deepEqual(searchResult.query.categories, [baselineItem.category ?? 'seasonal'])
  if (baselineItem.sourceKind) assert.deepEqual(searchResult.query.sourceKinds, [baselineItem.sourceKind])
  assert.ok(searchResult.items.some((item) => item.skuProfileId === skuProfileId))

  const exported = await executeFinalApiTool('exportSkuList', {
    platforms: ['tmall'],
    categories: [baselineItem.category ?? 'seasonal'],
    sourceKinds: baselineItem.sourceKind ? [baselineItem.sourceKind] : undefined,
    minStock: 40,
    maxStock: 50,
  })
  assert.equal(exported.status, 'SUCCEEDED')
  assert.match((exported.result as { csv: string }).csv, new RegExp(String(skuProfileId)))
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
  assert.equal(agentToolRiskLevel('exportSkuList'), 'L1')
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
  assert.equal(agentToolRequiresReviewGate('exportSkuList'), false)
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
