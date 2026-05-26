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
