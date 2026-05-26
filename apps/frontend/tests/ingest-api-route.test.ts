import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as ingestSkuRows } from '../src/app/api/ingest/route'
import { GET as getSkuDetail } from '../src/app/api/skus/[skuProfileId]/route'

const tenantAHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'ingest_route_tenant_a',
  'x-p0-tenant-id': 'ingest_route_tenant_a',
  'x-p0-session-id': 'ingest_route_session_a',
  'x-p0-surface': 'route-test',
  'x-request-id': 'ingest_route_request_a',
}

const tenantBHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'ingest_route_tenant_b',
  'x-p0-tenant-id': 'ingest_route_tenant_b',
  'x-p0-session-id': 'ingest_route_session_b',
  'x-p0-surface': 'route-test',
  'x-request-id': 'ingest_route_request_b',
}

test('ingest route writes sku rows under request tenant boundary', async () => {
  const externalSkuId = `ingest_route_boundary_${Date.now()}`
  const response = await ingestSkuRows(new Request('http://localhost/api/ingest', {
    method: 'POST',
    headers: tenantAHeaders,
    body: JSON.stringify({
      collectedAt: '2026-05-26T17:00:00.000Z',
      rows: [{
        platform: 'tmall',
        storeId: 'ingest_route_store',
        externalSkuId,
        productName: 'Ingest 路由租户边界 SKU',
        stock: 99,
        positiveRate: 0.98,
        raw: { externalSkuId },
      }],
    }),
  }))
  const envelope = await response.json()
  assert.equal(response.status, 200)
  assert.equal(envelope.code, 'OK')
  const skuProfileId = envelope.data.summaries[0]?.skuProfileId
  assert.ok(skuProfileId)

  const allowed = await getSkuDetail(
    new Request(`http://localhost/api/skus/${skuProfileId}`, { headers: tenantAHeaders }),
    { params: Promise.resolve({ skuProfileId }) },
  )
  assert.equal(allowed.status, 200)

  const denied = await getSkuDetail(
    new Request(`http://localhost/api/skus/${skuProfileId}`, { headers: tenantBHeaders }),
    { params: Promise.resolve({ skuProfileId }) },
  )
  const deniedEnvelope = await denied.json()
  assert.equal(denied.status, 403)
  assert.equal(deniedEnvelope.code, 'P0.TENANT_BOUNDARY_DENIED')
})
