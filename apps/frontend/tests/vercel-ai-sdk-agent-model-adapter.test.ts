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
  assert.ok(result.toolExecutions?.some((execution) => execution.toolCall.toolName === 'parseActivityRules'))
  assert.deepEqual(executedTools.filter((item) => item.toolName === 'parseActivityRules'), [{
    toolName: 'parseActivityRules',
    inputJson: {
      name: 'Agent Copilot 活动规则',
      platform: 'agent-copilot',
      sourceText: '活动库存不少于 20，好评率不少于 92%，证书状态必须有效。',
    },
  }])
})

test('vercel ai sdk agent model adapter exposes review item creation as an executable tool', async () => {
  const executedTools: Array<{ toolName: string; inputJson: Record<string, unknown> }> = []
  const adapter = new VercelAiSdkAgentModelAdapter({
    apiKey: 'test-key',
    modelName: 'test-model',
    model: { specificationVersion: 'v2', provider: 'test', modelId: 'test-model' } as never,
    generateText: (async (input: { tools?: Record<string, { execute?: (input: unknown) => Promise<unknown> }> }) => {
      const result = await input.tools?.createReviewItems?.execute?.({
        skuProfileId: 'sku_1',
        question: '确认这个 SKU 是否可以进入活动',
        recommendation: '建议人工复核',
        riskLevel: 'L2',
      })
      assert.deepEqual(result, {
        status: 'SUCCEEDED',
        summary: 'review created',
        data: [{ reviewItemId: 'review_1' }],
        evidenceRefs: [],
        linkedEntities: [],
        reviewGateId: null,
      })
      return {
        text: '已创建 Review',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        totalUsage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        finishReason: 'stop',
        response: { id: 'response_test_3' },
        providerMetadata: {},
      }
    }) as never,
  })

  const result = await adapter.complete({
    session: { id: 'session_1', sessionKey: 's', userId: null, surface: 'agent-copilot', piSessionKey: null, piSessionRef: null, title: null, status: 'ACTIVE', configJson: {}, lastActiveAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    mission: { id: 'mission_1', sessionId: 'session_1', missionType: 'goal_driven', objective: '创建人工复核', autonomyLevel: 'review_required', status: 'ACTIVE', sourceSurface: 'agent-copilot', subjectType: null, subjectId: null, constraintsJson: {}, workbenchContextJson: {}, planJson: {}, nextActionsJson: {}, createdBy: null, completedAt: null, canceledAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    run: { id: 'run_1', missionId: 'mission_1', sessionId: 'session_1', piRunId: null, workflowRunId: null, status: 'RUNNING', modelProvider: 'vercel-ai-sdk', modelName: 'test-model', inputJson: {}, outputJson: {}, errorMessage: null, timeoutMs: null, cancelRequested: false, usageJson: {}, metadataJson: {}, startedAt: '2026-05-24T00:00:00.000Z', completedAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    messages: [{ id: 'message_1', sessionId: 'session_1', runId: 'run_1', role: 'user', orderIndex: 1, contentText: '帮我创建人工复核', contentJson: {}, status: 'completed', parentId: null, createdAt: '2026-05-24T00:00:00.000Z' }],
    executeTool: async (input) => {
      executedTools.push({ toolName: input.toolName, inputJson: input.inputJson })
      return {
        toolCall: { id: 'tool_1', runId: input.run.id, externalToolCallId: null, workflowStepId: null, toolName: input.toolName, status: 'SUCCEEDED', riskLevel: 'L2', reviewPolicy: 'AUTO_ALLOW', inputJson: input.inputJson, outputJson: {}, evidenceRefsJson: {}, errorMessage: null, blockedReason: null, startedAt: '2026-05-24T00:00:00.000Z', completedAt: '2026-05-24T00:00:00.000Z', createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
        status: 'SUCCEEDED',
        summary: 'review created',
        data: [{ reviewItemId: 'review_1' }],
        evidenceRefs: [],
        linkedEntities: [],
        reviewGate: null,
      }
    },
  })

  assert.equal(result.content, '已创建 Review')
  assert.equal(result.toolExecutions?.[0]?.toolCall.toolName, 'createReviewItems')
  assert.deepEqual(executedTools, [{
    toolName: 'createReviewItems',
    inputJson: {
      skuProfileId: 'sku_1',
      question: '确认这个 SKU 是否可以进入活动',
      recommendation: '建议人工复核',
      riskLevel: 'L2',
    },
  }])
})

test('vercel ai sdk agent model adapter exposes system operation tools', async () => {
  const executedTools: Array<{ toolName: string; inputJson: Record<string, unknown> }> = []
  const adapter = new VercelAiSdkAgentModelAdapter({
    apiKey: 'test-key',
    modelName: 'test-model',
    model: { specificationVersion: 'v2', provider: 'test', modelId: 'test-model' } as never,
    generateText: (async (input: { tools?: Record<string, { execute?: (input: unknown) => Promise<unknown> }> }) => {
      await input.tools?.getHealthSummary?.execute?.({})
      await input.tools?.listRunConsole?.execute?.({ pageSize: 10, type: 'report_generate' })
      await input.tools?.exportRunLogs?.execute?.({ runId: 'run_1' })
      await input.tools?.listConnectors?.execute?.({ pageSize: 5 })
      await input.tools?.getConnectorDetail?.execute?.({ connectorId: 'connector_1' })
      await input.tools?.listConnectorRuns?.execute?.({ connectorId: 'connector_1', pageSize: 5 })
      await input.tools?.getConnectorRunDetail?.execute?.({ connectorRunId: 'connector_run_1' })
      await input.tools?.createConnector?.execute?.({ name: 'Agent 创建连接器', connectorKind: 'platform_api', platform: 'tmall', config: { endpoint: 'mock' } })
      await input.tools?.updateConnector?.execute?.({ connectorId: 'connector_1', name: 'Agent 更新连接器', status: 'ACTIVE' })
      await input.tools?.detectBrowserPage?.execute?.({ url: 'https://tmall.example.test/items', title: '天猫商品列表' })
      await input.tools?.previewBrowserScan?.execute?.({ url: 'https://tmall.example.test/items', rows: [{ sku: 'SKU-1', title: '商品1', stock: 12 }] })
      await input.tools?.ingestBrowserScan?.execute?.({ url: 'https://tmall.example.test/items', storeId: 'store_1', rows: [{ sku: 'SKU-1', title: '商品1', stock: 12 }] })
      await input.tools?.runConnectorSync?.execute?.({ connectorId: 'connector_1', rowCount: 12, qualityScore: 98 })
      await input.tools?.setConnectorStatus?.execute?.({ connectorId: 'connector_1', status: 'DISABLED' })
      await input.tools?.setRuleSetStatus?.execute?.({ ruleSetId: 'rule_1', status: 'DISABLED' })
      await input.tools?.getRuleSetDetail?.execute?.({ ruleSetId: 'rule_1' })
      await input.tools?.listRuleSetVersions?.execute?.({ ruleSetId: 'rule_1' })
      await input.tools?.createRuleSet?.execute?.({ name: 'Agent 规则集', sourceText: '库存 >= 20', platform: 'tmall', status: 'DRAFT' })
      await input.tools?.updateRuleSet?.execute?.({ ruleSetId: 'rule_1', name: 'Agent 更新规则集', sourceText: '库存 >= 30' })
      await input.tools?.createRuleSetVersion?.execute?.({ ruleSetId: 'rule_1' })
      await input.tools?.createActivity?.execute?.({ name: '618 大促', platform: 'tmall', productScopeText: '全量 SKU' })
      await input.tools?.updateActivity?.execute?.({ activityId: 'activity_1', status: 'RUNNING' })
      await input.tools?.getActivityExecutionPlan?.execute?.({ activityId: 'activity_1' })
      await input.tools?.getActivitySimulationRunDetail?.execute?.({ activityId: 'activity_1', simulationRunId: 'simulation_run_1' })
      await input.tools?.startActivityRun?.execute?.({ activityId: 'activity_1' })
      await input.tools?.ingestSkus?.execute?.({ rows: [{ platform: 'tmall', storeId: 'store_1', externalSkuId: 'SKU-1', stock: 12 }] })
      await input.tools?.retryRun?.execute?.({ runType: 'activity_simulation', sourceId: 'rule_1', runId: 'run_failed_1', skuProfileIds: ['sku_1'] })
      await input.tools?.listAgentMissions?.execute?.({ pageSize: 5 })
      await input.tools?.createAgentMission?.execute?.({ sessionKey: 'session_agent', objective: '检查活动执行' })
      await input.tools?.getAgentMission?.execute?.({ missionId: 'mission_1' })
      await input.tools?.startAgentRun?.execute?.({ missionId: 'mission_1', modelProvider: 'pi', modelName: 'sku-ready-agent' })
      await input.tools?.getAgentRunDetail?.execute?.({ runId: 'run_1' })
      await input.tools?.pauseAgentRun?.execute?.({ runId: 'run_1', pausedBy: 'tester' })
      await input.tools?.cancelAgentRun?.execute?.({ runId: 'run_1', canceledBy: 'tester', reason: '测试取消' })
      await input.tools?.answerAgentRunQuestion?.execute?.({ runId: 'run_1', question: '当前进度?' })
      await input.tools?.decideAgentReviewGate?.execute?.({ gateId: 'gate_1', decision: 'APPROVE', decidedBy: 'tester' })
      await input.tools?.getReviewDetail?.execute?.({ reviewItemId: 'review_1' })
      await input.tools?.updateReviewItem?.execute?.({ reviewItemId: 'review_1', recommendation: '补充证据后再审批', riskLevel: 'L2' })
      await input.tools?.decideReviewItem?.execute?.({ reviewItemId: 'review_1', decision: 'APPROVE', decisionComment: '同意 Agent 建议' })
      await input.tools?.generateReport?.execute?.({ type: 'HEALTH', skuProfileIds: ['sku_1'] })
      await input.tools?.listReviews?.execute?.({ tab: 'PENDING', reviewRiskLevel: 'HIGH', pageSize: 10 })
      await input.tools?.listReports?.execute?.({})
      await input.tools?.getReportDetail?.execute?.({ reportId: 'report_1' })
      await input.tools?.listReportVersions?.execute?.({ reportId: 'report_1' })
      await input.tools?.getReportVersion?.execute?.({ reportId: 'report_1', versionId: 'report_version_1' })
      await input.tools?.compareReports?.execute?.({ baseReportId: 'report_1', targetReportId: 'report_2' })
      await input.tools?.exportReport?.execute?.({ reportId: 'report_1', format: 'PDF' })
      await input.tools?.exportSkuList?.execute?.({ q: 'SKU-1', sortBy: 'updatedAt', sortOrder: 'desc' })
      await input.tools?.subscribeReport?.execute?.({ reportId: 'report_1', frequency: 'WEEKLY', recipients: ['ops@example.test'] })
      await input.tools?.getWorkspaceSettings?.execute?.({})
      await input.tools?.updateWorkspaceSettings?.execute?.({ dataFreshnessThresholdHours: 12 })
      await input.tools?.getToolPolicy?.execute?.({})
      await input.tools?.updateToolPolicy?.execute?.({ allowedAgentTools: ['getDashboardContext'] })
      await input.tools?.listSettingsUsers?.execute?.({})
      await input.tools?.updateSettingsUserStatus?.execute?.({ userId: 'qa_reviewer', status: 'ACTIVE' })
      await input.tools?.setSkuNextAction?.execute?.({ skuProfileId: 'sku_1', nextAction: { type: 'MANUAL_REVIEW', label: '提交人工确认' } })
      return {
        text: '已执行系统工具',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        totalUsage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        finishReason: 'stop',
        response: { id: 'response_test_4' },
        providerMetadata: {},
      }
    }) as never,
  })

  const result = await adapter.complete({
    session: { id: 'session_1', sessionKey: 's', userId: null, surface: 'agent-copilot', piSessionKey: null, piSessionRef: null, title: null, status: 'ACTIVE', configJson: {}, lastActiveAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    mission: { id: 'mission_1', sessionId: 'session_1', missionType: 'goal_driven', objective: '执行系统操作', autonomyLevel: 'review_required', status: 'ACTIVE', sourceSurface: 'agent-copilot', subjectType: null, subjectId: null, constraintsJson: {}, workbenchContextJson: {}, planJson: {}, nextActionsJson: {}, createdBy: null, completedAt: null, canceledAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    run: { id: 'run_1', missionId: 'mission_1', sessionId: 'session_1', piRunId: null, workflowRunId: null, status: 'RUNNING', modelProvider: 'vercel-ai-sdk', modelName: 'test-model', inputJson: {}, outputJson: {}, errorMessage: null, timeoutMs: null, cancelRequested: false, usageJson: {}, metadataJson: {}, startedAt: '2026-05-24T00:00:00.000Z', completedAt: null, createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
    messages: [{ id: 'message_1', sessionId: 'session_1', runId: 'run_1', role: 'user', orderIndex: 1, contentText: '同步连接器并导出报告', contentJson: {}, status: 'completed', parentId: null, createdAt: '2026-05-24T00:00:00.000Z' }],
    executeTool: async (input) => {
      executedTools.push({ toolName: input.toolName, inputJson: input.inputJson })
      return {
        toolCall: { id: `tool_${executedTools.length}`, runId: input.run.id, externalToolCallId: null, workflowStepId: null, toolName: input.toolName, status: 'SUCCEEDED', riskLevel: input.toolName === 'listConnectors' || input.toolName === 'listReports' || input.toolName === 'listRunConsole' ? 'L1' : 'L2', reviewPolicy: 'AUTO_ALLOW', inputJson: input.inputJson, outputJson: {}, evidenceRefsJson: {}, errorMessage: null, blockedReason: null, startedAt: '2026-05-24T00:00:00.000Z', completedAt: '2026-05-24T00:00:00.000Z', createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' },
        status: 'SUCCEEDED',
        summary: 'ok',
        data: {},
        evidenceRefs: [],
        linkedEntities: [],
        reviewGate: null,
      }
    },
  })

  assert.equal(result.content, '已执行系统工具')
  assert.deepEqual(executedTools.map((item) => item.toolName), ['getHealthSummary', 'listRunConsole', 'exportRunLogs', 'listConnectors', 'getConnectorDetail', 'listConnectorRuns', 'getConnectorRunDetail', 'createConnector', 'updateConnector', 'detectBrowserPage', 'previewBrowserScan', 'ingestBrowserScan', 'runConnectorSync', 'setConnectorStatus', 'setRuleSetStatus', 'getRuleSetDetail', 'listRuleSetVersions', 'createRuleSet', 'updateRuleSet', 'createRuleSetVersion', 'createActivity', 'updateActivity', 'getActivityExecutionPlan', 'getActivitySimulationRunDetail', 'startActivityRun', 'ingestSkus', 'retryRun', 'listAgentMissions', 'createAgentMission', 'getAgentMission', 'startAgentRun', 'getAgentRunDetail', 'pauseAgentRun', 'cancelAgentRun', 'answerAgentRunQuestion', 'decideAgentReviewGate', 'getReviewDetail', 'updateReviewItem', 'decideReviewItem', 'generateReport', 'listReviews', 'listReports', 'getReportDetail', 'listReportVersions', 'getReportVersion', 'compareReports', 'exportReport', 'exportSkuList', 'subscribeReport', 'getWorkspaceSettings', 'updateWorkspaceSettings', 'getToolPolicy', 'updateToolPolicy', 'listSettingsUsers', 'updateSettingsUserStatus', 'setSkuNextAction'])
  assert.equal(executedTools.find((item) => item.toolName === 'retryRun')?.inputJson.runType, 'activity_simulation')
  assert.deepEqual(executedTools.at(-1)?.inputJson, { skuProfileId: 'sku_1', nextAction: { type: 'MANUAL_REVIEW', label: '提交人工确认' } })
})

test('vercel ai sdk model adapter env factory fails closed without key', () => {
  assert.equal(createVercelAiSdkAgentModelAdapterFromEnv({}), undefined)
  assert.equal(createVercelAiSdkAgentModelAdapterFromEnv({ OPENAI_API_KEY: '   ' }), undefined)
})
