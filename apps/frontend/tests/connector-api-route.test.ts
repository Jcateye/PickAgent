import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as createConnector } from '../src/app/api/connectors/route'
import { DELETE as disableConnector, PATCH as updateConnector } from '../src/app/api/connectors/[connectorId]/route'
import { GET as listConnectorRuns, POST as createConnectorRun } from '../src/app/api/connectors/[connectorId]/sync-runs/route'
import { POST as ingestBrowserScan } from '../src/app/api/connectors/browser/scan-ingest/route'
import { finalApiRuntime } from '../src/app/api/_final-api-runtime'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'connector_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'connector_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'connector_route_request',
}

test('connector write and run routes return not found for missing connector', async () => {
  const params = { params: Promise.resolve({ connectorId: 'missing_connector' }) }

  const updateResponse = await updateConnector(
    new Request('http://localhost/api/connectors/missing_connector', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ name: 'missing connector' }),
    }),
    params,
  )
  const updateEnvelope = await updateResponse.json()
  assert.equal(updateResponse.status, 404)
  assert.equal(updateEnvelope.code, 'CONNECTOR.NOT_FOUND')

  const disableResponse = await disableConnector(new Request('http://localhost/api/connectors/missing_connector', { method: 'DELETE', headers: authHeaders }), params)
  const disableEnvelope = await disableResponse.json()
  assert.equal(disableResponse.status, 404)
  assert.equal(disableEnvelope.code, 'CONNECTOR.NOT_FOUND')

  const listRunsResponse = await listConnectorRuns(new Request('http://localhost/api/connectors/missing_connector/sync-runs', { headers: authHeaders }), params)
  const listRunsEnvelope = await listRunsResponse.json()
  assert.equal(listRunsResponse.status, 404)
  assert.equal(listRunsEnvelope.code, 'CONNECTOR.NOT_FOUND')

  const createRunResponse = await createConnectorRun(
    new Request('http://localhost/api/connectors/missing_connector/sync-runs', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ rowCount: 10 }),
    }),
    params,
  )
  const createRunEnvelope = await createRunResponse.json()
  assert.equal(createRunResponse.status, 404)
  assert.equal(createRunEnvelope.code, 'CONNECTOR.NOT_FOUND')
})

test('connector sync route rejects disabled connector as a conflict', async () => {
  const createdResponse = await createConnector(
    new Request('http://localhost/api/connectors', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: `disabled_connector_${Date.now()}`,
        name: 'Disabled Connector',
        kind: 'platform_api',
        platform: 'tmall',
        status: 'DISABLED',
      }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)

  const connectorId = createdEnvelope.data.connectorId
  const response = await createConnectorRun(
    new Request(`http://localhost/api/connectors/${connectorId}/sync-runs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ rowCount: 10 }),
    }),
    { params: Promise.resolve({ connectorId }) },
  )
  const envelope = await response.json()

  assert.equal(response.status, 409)
  assert.equal(envelope.code, 'CONNECTOR.CONFLICT')
})

test('connector write routes return workflow run ids for audit navigation', async () => {
  const createdResponse = await createConnector(
    new Request('http://localhost/api/connectors', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: `audit_connector_${Date.now()}`,
        name: 'Audit Connector',
        kind: 'platform_api',
        platform: 'tmall',
        status: 'ACTIVE',
      }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)
  assert.match(createdEnvelope.data.workflowRunId, /^workflow_/)
  const connectorId = createdEnvelope.data.connectorId

  const updateResponse = await updateConnector(
    new Request(`http://localhost/api/connectors/${connectorId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Audit Connector Updated' }),
    }),
    { params: Promise.resolve({ connectorId }) },
  )
  const updateEnvelope = await updateResponse.json()
  assert.equal(updateResponse.status, 200)
  assert.match(updateEnvelope.data.workflowRunId, /^workflow_/)

  const disableResponse = await disableConnector(new Request(`http://localhost/api/connectors/${connectorId}`, { method: 'DELETE', headers: authHeaders }), { params: Promise.resolve({ connectorId }) })
  const disableEnvelope = await disableResponse.json()
  assert.equal(disableResponse.status, 200)
  assert.match(disableEnvelope.data.workflowRunId, /^workflow_/)
})

test('browser scan ingest route writes SKU data and connector run atomically', async () => {
  const createdResponse = await createConnector(
    new Request('http://localhost/api/connectors', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: `browser_ingest_connector_${Date.now()}`,
        name: 'Browser Ingest Connector',
        kind: 'browser_extension',
        platform: 'tmall',
        status: 'ACTIVE',
      }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)

  const connectorId = createdEnvelope.data.connectorId
  const externalSkuId = `browser_scan_sku_${Date.now()}`
  const response = await ingestBrowserScan(
    new Request('http://localhost/api/connectors/browser/scan-ingest', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        connectorId,
        url: 'https://tmall.example.test/sku-list',
        storeId: 'browser_store',
        rows: [{ sku: externalSkuId, title: '浏览器扫描写入 SKU', stock: 42, sales: 188, positiveRate: 0.97 }],
      }),
    }),
  )
  const envelope = await response.json()

  assert.equal(response.status, 200)
  assert.equal(envelope.data.preview.ingestReady, true)
  assert.equal(envelope.data.ingest.summaries[0].canonicalSkuKey, `tmall:browser_store:${externalSkuId}`)
  assert.equal(envelope.data.run.connectorId, connectorId)

  const detail = await finalApiRuntime.ingestService.getSkuDetail(envelope.data.ingest.summaries[0].skuProfileId)
  assert.equal(detail?.productName, '浏览器扫描写入 SKU')
  assert.equal(detail?.latestSnapshot?.stock, 42)
})
