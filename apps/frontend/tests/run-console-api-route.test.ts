import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as listRuns } from '../src/app/api/run-console/route'
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
})
