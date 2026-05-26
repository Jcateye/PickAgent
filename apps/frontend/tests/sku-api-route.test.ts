import assert from 'node:assert/strict'
import test from 'node:test'

import { finalApiRuntime } from '../src/app/api/_final-api-runtime'
import { GET as getSkuDetail, PATCH as updateSkuNextAction } from '../src/app/api/skus/[skuProfileId]/route'
import { GET as downloadSkuExport } from '../src/app/api/skus/export/download/route'
import { POST as exportSkus } from '../src/app/api/skus/export/route'

const tenantAHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'sku_route_tenant_a',
  'x-p0-tenant-id': 'sku_route_tenant_a',
  'x-p0-session-id': 'sku_route_session_a',
  'x-p0-surface': 'route-test',
  'x-request-id': 'sku_route_request_a',
}

const tenantBHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'sku_route_tenant_b',
  'x-p0-tenant-id': 'sku_route_tenant_b',
  'x-p0-session-id': 'sku_route_session_b',
  'x-p0-surface': 'route-test',
  'x-request-id': 'sku_route_request_b',
}

test('sku detail and next action routes return stable missing and tenant boundary envelopes', async () => {
  const missingResponse = await getSkuDetail(
    new Request('http://localhost/api/skus/missing_sku_for_route', { headers: tenantAHeaders }),
    { params: Promise.resolve({ skuProfileId: 'missing_sku_for_route' }) },
  )
  const missingEnvelope = await missingResponse.json()
  assert.equal(missingResponse.status, 404)
  assert.equal(missingEnvelope.code, 'SKU.NOT_FOUND')

  const externalSkuId = `sku_route_cross_tenant_${Date.now()}`
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T10:00:00.000Z',
    rows: [
      {
        platform: 'tmall',
        storeId: 'sku_route_store',
        externalSkuId,
        productName: '跨租户 SKU 路由测试',
        stock: 20,
        positiveRate: 0.97,
        raw: { externalSkuId },
      },
    ],
  }, {
    actorId: 'sku_route_tenant_a',
    tenantId: 'sku_route_tenant_a',
    sessionId: 'sku_route_session_a',
    surface: 'route-test',
    requestId: 'sku_route_ingest_a',
  })
  const skuProfileId = ingest.summaries[0].skuProfileId

  const deniedGetResponse = await getSkuDetail(
    new Request(`http://localhost/api/skus/${skuProfileId}`, { headers: tenantBHeaders }),
    { params: Promise.resolve({ skuProfileId }) },
  )
  const deniedGetEnvelope = await deniedGetResponse.json()
  assert.equal(deniedGetResponse.status, 403)
  assert.equal(deniedGetEnvelope.code, 'P0.TENANT_BOUNDARY_DENIED')

  const deniedPatchResponse = await updateSkuNextAction(
    new Request(`http://localhost/api/skus/${skuProfileId}`, {
      method: 'PATCH',
      headers: tenantBHeaders,
      body: JSON.stringify({ nextAction: { type: 'MANUAL_REVIEW', label: '提交人工确认' } }),
    }),
    { params: Promise.resolve({ skuProfileId }) },
  )
  const deniedPatchEnvelope = await deniedPatchResponse.json()
  assert.equal(deniedPatchResponse.status, 403)
  assert.equal(deniedPatchEnvelope.code, 'P0.TENANT_BOUNDARY_DENIED')
})

test('sku next action route returns workflow run id for audit navigation', async () => {
  const externalSkuId = `sku_route_next_action_${Date.now()}`
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T10:30:00.000Z',
    rows: [
      {
        platform: 'tmall',
        storeId: 'sku_route_store',
        externalSkuId,
        productName: '下一步动作路由测试',
        stock: 8,
        positiveRate: 0.93,
        raw: { externalSkuId },
      },
    ],
  }, {
    actorId: 'sku_route_tenant_a',
    tenantId: 'sku_route_tenant_a',
    sessionId: 'sku_route_session_a',
    surface: 'route-test',
    requestId: 'sku_route_next_action_ingest',
  })
  const skuProfileId = ingest.summaries[0].skuProfileId

  const response = await updateSkuNextAction(
    new Request(`http://localhost/api/skus/${skuProfileId}`, {
      method: 'PATCH',
      headers: tenantAHeaders,
      body: JSON.stringify({
        nextAction: { type: 'MANUAL_REVIEW', label: '提交人工确认' },
        comment: 'route-test-next-action',
      }),
    }),
    { params: Promise.resolve({ skuProfileId }) },
  )
  const envelope = await response.json()
  assert.equal(response.status, 200)
  assert.equal(envelope.code, 'OK')
  assert.match(envelope.data.workflowRunId, /^workflow_/)
  assert.equal(envelope.data.statusSummary.nextStep, '提交人工确认')

  const audits = await finalApiRuntime.workflowAuditService.list({
    actorId: 'sku_route_tenant_a',
    tenantId: 'sku_route_tenant_a',
    sessionId: 'sku_route_session_a',
    surface: 'route-test',
    requestId: 'sku_route_next_action_audit',
  }, 20)
  const audit = audits.find((item) => item.workflowRunId === envelope.data.workflowRunId)
  assert.equal(audit?.workflowType, 'sku_next_action_update')
  assert.equal(audit?.subjectId, skuProfileId)
})

test('sku export route returns backend csv and workflow audit', async () => {
  const externalSkuId = `sku_route_export_${Date.now()}`
  const boundary = {
    actorId: 'sku_route_tenant_a',
    tenantId: 'sku_route_tenant_a',
    sessionId: 'sku_route_session_a',
    surface: 'route-test',
    requestId: 'sku_route_export_ingest',
  }
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T11:00:00.000Z',
    rows: [
      {
        platform: 'tmall',
        storeId: 'sku_route_export_store',
        externalSkuId,
        productName: 'SKU 导出路由测试',
        stock: 12,
        positiveRate: 0.96,
        raw: { externalSkuId },
      },
    ],
  }, boundary)

  const response = await exportSkus(new Request('http://localhost/api/skus/export', {
    method: 'POST',
    headers: tenantAHeaders,
    body: JSON.stringify({ query: { q: externalSkuId, sortBy: 'updatedAt', sortOrder: 'desc' } }),
  }))
  const envelope = await response.json()
  assert.equal(response.status, 200)
  assert.equal(envelope.code, 'OK')
  assert.equal(envelope.data.rowCount, 1)
  assert.match(envelope.data.csv, /skuProfileId,displaySku,productName/)
  assert.match(envelope.data.csv, new RegExp(ingest.summaries[0].skuProfileId))
  assert.match(envelope.data.artifactHref, /\/api\/skus\/export\/download\?/)
  assert.ok(envelope.data.workflowRunId)

  const audits = await finalApiRuntime.workflowAuditService.list(boundary, 20)
  const audit = audits.find((item) => item.workflowRunId === envelope.data.workflowRunId)
  assert.equal(audit?.workflowType, 'sku_export')
  assert.equal(audit?.output.rowCount, 1)
  assert.equal(audit?.output.artifactHref, envelope.data.artifactHref)

  const downloadResponse = await downloadSkuExport(new Request(`http://localhost${envelope.data.artifactHref}`, {
    method: 'GET',
    headers: tenantAHeaders,
  }))
  assert.equal(downloadResponse.status, 200)
  assert.match(downloadResponse.headers.get('content-disposition') ?? '', /attachment/)
  assert.match(await downloadResponse.text(), new RegExp(ingest.summaries[0].skuProfileId))
})
