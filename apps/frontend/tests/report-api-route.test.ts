import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as compareReports } from '../src/app/api/reports/compare/route'
import { POST as exportReport } from '../src/app/api/reports/[reportId]/export/route'
import { POST as subscribeReport } from '../src/app/api/reports/[reportId]/subscriptions/route'
import { GET as listReportVersions } from '../src/app/api/reports/[reportId]/versions/route'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'report_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'report_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'report_route_request',
}

test('report routes return not found for missing report write and version actions', async () => {
  const exportResponse = await exportReport(
    new Request('http://localhost/api/reports/missing_report/export', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ format: 'PDF' }),
    }),
    { params: Promise.resolve({ reportId: 'missing_report' }) },
  )
  const exportEnvelope = await exportResponse.json()
  assert.equal(exportResponse.status, 404)
  assert.equal(exportEnvelope.code, 'REPORT.NOT_FOUND')

  const subscriptionResponse = await subscribeReport(
    new Request('http://localhost/api/reports/missing_report/subscriptions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ frequency: 'WEEKLY', recipients: ['ops@example.test'] }),
    }),
    { params: Promise.resolve({ reportId: 'missing_report' }) },
  )
  const subscriptionEnvelope = await subscriptionResponse.json()
  assert.equal(subscriptionResponse.status, 404)
  assert.equal(subscriptionEnvelope.code, 'REPORT.NOT_FOUND')

  const versionsResponse = await listReportVersions(
    new Request('http://localhost/api/reports/missing_report/versions', {
      method: 'GET',
      headers: authHeaders,
    }),
    { params: Promise.resolve({ reportId: 'missing_report' }) },
  )
  const versionsEnvelope = await versionsResponse.json()
  assert.equal(versionsResponse.status, 404)
  assert.equal(versionsEnvelope.code, 'REPORT.NOT_FOUND')

  const compareResponse = await compareReports(
    new Request('http://localhost/api/reports/compare', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ baseReportId: 'missing_base', targetReportId: 'missing_target' }),
    }),
  )
  const compareEnvelope = await compareResponse.json()
  assert.equal(compareResponse.status, 404)
  assert.equal(compareEnvelope.code, 'REPORT.NOT_FOUND')
})
