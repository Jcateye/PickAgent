import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as listRuns } from '../src/app/api/run-console/route'
import { POST as exportRunLogs } from '../src/app/api/run-console/[runId]/export/route'
import { finalApiRuntime, finalReportSnapshotRequest } from '../src/app/api/_final-api-runtime'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'run_console_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'run_console_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'run_console_request',
}

test('run console lists report generation audits as real workflow runs', async () => {
  await finalReportSnapshotRequest
  const skuProfileId = Array.from(finalApiRuntime.store.projections.keys())[0]
  assert.ok(skuProfileId)
  const report = await finalApiRuntime.reportService.generate({ type: 'HEALTH', skuProfileIds: [skuProfileId], simulationResultIds: [] }, {
    actorId: 'run_console_tester',
    tenantId: 'dev_tenant',
    sessionId: 'run_console_session',
    surface: 'route-test',
    requestId: 'run_console_generate',
  })

  const response = await listRuns(new Request('http://localhost/api/run-console', { headers: authHeaders }))
  const envelope = await response.json()

  assert.equal(response.status, 200)
  assert.ok(envelope.data.items.some((item: { type: string; sourceId?: string; subject: string }) => (
    item.type === 'report_generate'
    && item.sourceId === report.reportId
    && item.subject === `report:${report.reportId}`
  )))

  const run = envelope.data.items.find((item: { type: string; sourceId?: string }) => item.type === 'report_generate' && item.sourceId === report.reportId)
  assert.ok(run?.runId)
  const exportResponse = await exportRunLogs(
    new Request(`http://localhost/api/run-console/${run.runId}/export`, { method: 'POST', headers: authHeaders }),
    { params: Promise.resolve({ runId: run.runId }) },
  )
  const exportEnvelope = await exportResponse.json()
  assert.equal(exportResponse.status, 200)
  assert.equal(exportEnvelope.data.runId, run.runId)
  assert.match(exportEnvelope.data.content, new RegExp(`Run ${run.runId}`))
  assert.match(exportEnvelope.data.content, /report_generate/)
})

test('run console links activity simulation audits back to restored rule execution', async () => {
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T13:00:00.000Z',
    rows: [{
      platform: 'tmall',
      storeId: 'run_console_simulation_store',
      externalSkuId: `run_console_simulation_${Date.now()}`,
      productName: 'Run Console 模拟回链 SKU',
      stock: 42,
      positiveRate: 0.97,
      raw: {},
    }],
  }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_simulation_ingest',
  })
  const skuProfileId = ingest.summaries[0].skuProfileId
  const ruleSet = await finalApiRuntime.ruleSetService.create({
    name: 'Run Console 模拟回链规则',
    sourceText: '库存不得低于 20 件。',
    platform: 'tmall',
    status: 'ENABLED',
  }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_simulation_rule',
  })
  const run = await finalApiRuntime.activityService.simulate(ruleSet.ruleSetId, { skuProfileIds: [skuProfileId] }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_simulation_run',
  })
  assert.ok(run.workflowRunId)

  const response = await listRuns(new Request('http://localhost/api/run-console?pageSize=100', { headers: authHeaders }))
  const envelope = await response.json()
  assert.equal(response.status, 200)
  const auditRun = envelope.data.items.find((item: { runId: string }) => item.runId === run.workflowRunId)
  assert.equal(auditRun?.type, 'activity_simulation')
  assert.equal(auditRun?.sourceHref, `/rule-execution?ruleSetId=${ruleSet.ruleSetId}&simulationRunId=${run.simulationRunId}`)
})

test('run console links settings audits back to settings workbench', async () => {
  const workspace = await finalApiRuntime.workspaceSettingsService.updateWorkspace({ dataFreshnessThresholdHours: 21 }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_settings_workspace',
  })
  const user = await finalApiRuntime.workspaceSettingsService.updateUserStatus('qa_reviewer', 'ACTIVE', {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_settings_user',
  })
  assert.ok(workspace.workflowRunId)
  assert.ok(user.workflowRunId)

  const response = await listRuns(new Request('http://localhost/api/run-console?pageSize=100', { headers: authHeaders }))
  const envelope = await response.json()
  assert.equal(response.status, 200)
  const workspaceRun = envelope.data.items.find((item: { runId: string }) => item.runId === workspace.workflowRunId)
  const userRun = envelope.data.items.find((item: { runId: string }) => item.runId === user.workflowRunId)
  assert.equal(workspaceRun?.sourceHref, '/settings')
  assert.equal(userRun?.sourceHref, '/settings')
})

test('run console exposes workflow audit input and output as structured payloads', async () => {
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T14:00:00.000Z',
    rows: [{
      platform: 'tmall',
      storeId: 'run_console_candidate_store',
      externalSkuId: `run_console_candidate_${Date.now()}`,
      productName: 'Run Console 候选清单 SKU',
      stock: 55,
      positiveRate: 0.98,
      raw: {},
    }],
  }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_candidate_ingest',
  })
  const skuProfileId = ingest.summaries[0].skuProfileId
  const activity = await finalApiRuntime.activityService.create({ name: `Run Console Candidate ${Date.now()}`, platform: 'tmall' }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_candidate_activity',
  })
  const candidate = await finalApiRuntime.activityService.addCandidateSkus(activity.activityId, [skuProfileId], {
    reasonCode: 'run-console-test',
    comment: 'verify payload',
  }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'run_console_candidate_add',
  })

  const response = await listRuns(new Request('http://localhost/api/run-console?pageSize=100', { headers: authHeaders }))
  const envelope = await response.json()
  assert.equal(response.status, 200)
  const run = envelope.data.items.find((item: { runId: string }) => item.runId === candidate.workflowRunId)
  assert.equal(run?.type, 'activity_candidate_skus')
  assert.equal(run?.sourceHref, `/rule-execution?activityId=${activity.activityId}`)
  assert.deepEqual(run?.logs[0]?.payload.skuProfileIds, [skuProfileId])
  assert.deepEqual(run?.logs[1]?.payload.addedSkuProfileIds, [skuProfileId])
})
