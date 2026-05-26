import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as createReport } from '../src/app/api/reports/route'
import { POST as compareReports } from '../src/app/api/reports/compare/route'
import { GET as downloadReportExport } from '../src/app/api/reports/[reportId]/download/route'
import { POST as exportReport } from '../src/app/api/reports/[reportId]/export/route'
import { POST as subscribeReport } from '../src/app/api/reports/[reportId]/subscriptions/route'
import { GET as listReportVersions } from '../src/app/api/reports/[reportId]/versions/route'
import { finalApiRuntime, finalReportSnapshotRequest } from '../src/app/api/_final-api-runtime'

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

test('report create route rejects missing sku evidence instead of creating empty report', async () => {
  const response = await createReport(
    new Request('http://localhost/api/reports', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type: 'HEALTH', skuProfileIds: ['missing_sku_profile_for_route'], simulationResultIds: [] }),
    }),
  )
  const envelope = await response.json()

  assert.equal(response.status, 400)
  assert.equal(envelope.code, 'COMMON.VALIDATION_ERROR')
  assert.match(envelope.message, /SKU not found for report: missing_sku_profile_for_route/)
})

test('report create route records generation audit for run console', async () => {
  await finalReportSnapshotRequest
  const beforeIds = new Set(Array.from(finalApiRuntime.store.workflowAudits.keys()))
  const skuProfileId = Array.from(finalApiRuntime.store.projections.keys())[0]
  assert.ok(skuProfileId)

  const response = await createReport(
    new Request('http://localhost/api/reports', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type: 'HEALTH', skuProfileIds: [skuProfileId], simulationResultIds: [] }),
    }),
  )
  const envelope = await response.json()
  assert.equal(response.status, 200)
  assert.match(envelope.data.workflowRunId, /^workflow_/)

  const newAudits = Array.from(finalApiRuntime.store.workflowAudits.entries())
    .filter(([workflowRunId]) => !beforeIds.has(workflowRunId))
    .map(([, audit]) => audit)
  assert.ok(newAudits.some((audit) => audit.workflowType === 'report_generate' && audit.subjectId === envelope.data.reportId && audit.input.actorId === 'report_route_tester'))
  assert.ok(newAudits.some((audit) => audit.workflowRunId === envelope.data.workflowRunId && audit.subjectId === envelope.data.reportId))
})

test('report write routes reject invalid export and subscription values before persistence', async () => {
  await finalReportSnapshotRequest
  const skuProfileId = Array.from(finalApiRuntime.store.projections.keys())[0]
  assert.ok(skuProfileId)
  const created = await createReport(
    new Request('http://localhost/api/reports', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type: 'HEALTH', skuProfileIds: [skuProfileId], simulationResultIds: [] }),
    }),
  )
  const createdEnvelope = await created.json()
  assert.equal(created.status, 200)
  const reportId = createdEnvelope.data.reportId

  const exportResponse = await exportReport(
    new Request(`http://localhost/api/reports/${reportId}/export`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ format: 'TXT' }),
    }),
    { params: Promise.resolve({ reportId }) },
  )
  const exportEnvelope = await exportResponse.json()
  assert.equal(exportResponse.status, 400)
  assert.equal(exportEnvelope.code, 'COMMON.VALIDATION_ERROR')

  const subscriptionResponse = await subscribeReport(
    new Request(`http://localhost/api/reports/${reportId}/subscriptions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ frequency: 'YEARLY', recipients: ['ops@example.test'] }),
    }),
    { params: Promise.resolve({ reportId }) },
  )
  const subscriptionEnvelope = await subscriptionResponse.json()
  assert.equal(subscriptionResponse.status, 400)
  assert.equal(subscriptionEnvelope.code, 'COMMON.VALIDATION_ERROR')
})

test('report export creates a ready downloadable artifact and updates list status', async () => {
  await finalReportSnapshotRequest
  const skuProfileId = Array.from(finalApiRuntime.store.projections.keys())[0]
  assert.ok(skuProfileId)
  const created = await createReport(
    new Request('http://localhost/api/reports', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type: 'HEALTH', skuProfileIds: [skuProfileId], simulationResultIds: [] }),
    }),
  )
  const createdEnvelope = await created.json()
  assert.equal(created.status, 200)
  const reportId = createdEnvelope.data.reportId

  const exportResponse = await exportReport(
    new Request(`http://localhost/api/reports/${reportId}/export`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ format: 'EXCEL', includeCharts: true, includeDetails: true, idempotencyKey: 'downloadable-artifact' }),
    }),
    { params: Promise.resolve({ reportId }) },
  )
  const exportEnvelope = await exportResponse.json()
  assert.equal(exportResponse.status, 200)
  assert.equal(exportEnvelope.data.status, 'READY')
  assert.match(exportEnvelope.data.artifactHref, new RegExp(`/api/reports/${reportId}/download\\\\?`))
  assert.equal(finalApiRuntime.store.reportExports.get(`${reportId}:downloadable-artifact`)?.status, 'READY')

  const list = await finalApiRuntime.reportService.list()
  const exportedReport = list.items.find((item) => item.reportId === reportId)
  assert.equal(exportedReport?.exportStatus, 'READY')

  const downloadResponse = await downloadReportExport(
    new Request(`http://localhost${exportEnvelope.data.artifactHref}`, {
      method: 'GET',
      headers: authHeaders,
    }),
    { params: Promise.resolve({ reportId }) },
  )
  assert.equal(downloadResponse.status, 200)
  assert.match(downloadResponse.headers.get('content-disposition') ?? '', /attachment/)
  assert.match(await downloadResponse.text(), /reportId/)
})
