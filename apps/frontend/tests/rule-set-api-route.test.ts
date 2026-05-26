import assert from 'node:assert/strict'
import test from 'node:test'

import { DELETE as deleteRuleSet, GET as getRuleSet, PATCH as updateRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/route'
import { POST as disableRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/disable/route'
import { POST as enableRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/enable/route'
import { GET as getRuleSetSimulationRun } from '../src/app/api/rule-sets/[ruleSetId]/simulations/[simulationRunId]/route'
import { POST as simulateRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/simulations/route'
import { GET as listRuleSetVersions, POST as createRuleSetVersion } from '../src/app/api/rule-sets/[ruleSetId]/versions/route'
import { GET as listRuleSets, POST as createRuleSet } from '../src/app/api/rule-sets/route'
import { finalApiRuntime } from '../src/app/api/_final-api-runtime'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'rule_set_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'rule_set_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'rule_set_route_request',
}

const otherTenantHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'rule_set_route_other_tenant',
  'x-p0-tenant-id': 'other_tenant',
  'x-p0-session-id': 'rule_set_route_other_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'rule_set_route_other_request',
}

test('rule set routes return stable auth envelopes when P0 context is missing', async () => {
  const ruleSetId = 'missing_auth_rule_set'
  const params = { params: Promise.resolve({ ruleSetId }) }
  const responses = await Promise.all([
    listRuleSets(new Request('http://localhost/api/rule-sets')),
    createRuleSet(new Request('http://localhost/api/rule-sets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing Auth Rule', sourceText: '库存不得低于 20 件。', platform: 'tmall' }),
    })),
    getRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}`), params),
    updateRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing Auth Rule Updated' }),
    }), params),
    deleteRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}`, { method: 'DELETE' }), params),
    enableRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/enable`, { method: 'POST' }), params),
    disableRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/disable`, { method: 'POST' }), params),
    listRuleSetVersions(new Request(`http://localhost/api/rule-sets/${ruleSetId}/versions`), params),
    createRuleSetVersion(new Request(`http://localhost/api/rule-sets/${ruleSetId}/versions`, { method: 'POST' }), params),
    simulateRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skuProfileIds: ['missing_auth_sku'] }),
    }), params),
    getRuleSetSimulationRun(new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations/missing_auth_simulation`), { params: Promise.resolve({ ruleSetId, simulationRunId: 'missing_auth_simulation' }) }),
  ])

  for (const response of responses) {
    const envelope = await response.json()
    assert.equal(response.status, 401)
    assert.equal(envelope.code, 'COMMON.VALIDATION_ERROR')
  }
})

test('rule set detail route returns stable validation envelope for unexpected service errors', async () => {
  const originalGet = finalApiRuntime.ruleSetService.get
  const ruleSetId = 'unexpected_rule_error'
  finalApiRuntime.ruleSetService.get = async () => {
    throw new Error('repository unavailable for route test')
  }
  try {
    const response = await getRuleSet(
      new Request(`http://localhost/api/rule-sets/${ruleSetId}`, { headers: authHeaders }),
      { params: Promise.resolve({ ruleSetId }) },
    )
    const envelope = await response.json()
    assert.equal(response.status, 400)
    assert.equal(envelope.code, 'COMMON.VALIDATION_ERROR')
    assert.match(envelope.message, /repository unavailable/)
  } finally {
    finalApiRuntime.ruleSetService.get = originalGet
  }
})

test('rule set routes return not found for missing rule set reads and writes', async () => {
  const params = { params: Promise.resolve({ ruleSetId: 'missing_rule_set' }) }

  const getResponse = await getRuleSet(new Request('http://localhost/api/rule-sets/missing_rule_set', { headers: authHeaders }), params)
  const getEnvelope = await getResponse.json()
  assert.equal(getResponse.status, 404)
  assert.equal(getEnvelope.code, 'RULE.NOT_FOUND')

  const updateResponse = await updateRuleSet(
    new Request('http://localhost/api/rule-sets/missing_rule_set', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ name: 'missing' }),
    }),
    params,
  )
  const updateEnvelope = await updateResponse.json()
  assert.equal(updateResponse.status, 404)
  assert.equal(updateEnvelope.code, 'RULE.NOT_FOUND')

  const deleteResponse = await deleteRuleSet(new Request('http://localhost/api/rule-sets/missing_rule_set', { method: 'DELETE', headers: authHeaders }), params)
  const deleteEnvelope = await deleteResponse.json()
  assert.equal(deleteResponse.status, 404)
  assert.equal(deleteEnvelope.code, 'RULE.NOT_FOUND')

  const enableResponse = await enableRuleSet(new Request('http://localhost/api/rule-sets/missing_rule_set/enable', { method: 'POST', headers: authHeaders }), params)
  const enableEnvelope = await enableResponse.json()
  assert.equal(enableResponse.status, 404)
  assert.equal(enableEnvelope.code, 'RULE.NOT_FOUND')

  const disableResponse = await disableRuleSet(new Request('http://localhost/api/rule-sets/missing_rule_set/disable', { method: 'POST', headers: authHeaders }), params)
  const disableEnvelope = await disableResponse.json()
  assert.equal(disableResponse.status, 404)
  assert.equal(disableEnvelope.code, 'RULE.NOT_FOUND')
})

test('rule set version routes reject missing rule set instead of returning empty data', async () => {
  const params = { params: Promise.resolve({ ruleSetId: 'missing_rule_set_for_versions' }) }

  const listResponse = await listRuleSetVersions(new Request('http://localhost/api/rule-sets/missing_rule_set_for_versions/versions', { headers: authHeaders }), params)
  const listEnvelope = await listResponse.json()
  assert.equal(listResponse.status, 404)
  assert.equal(listEnvelope.code, 'RULE.NOT_FOUND')

  const createResponse = await createRuleSetVersion(new Request('http://localhost/api/rule-sets/missing_rule_set_for_versions/versions', { method: 'POST', headers: authHeaders }), params)
  const createEnvelope = await createResponse.json()
  assert.equal(createResponse.status, 404)
  assert.equal(createEnvelope.code, 'RULE.NOT_FOUND')
})

test('rule set simulation route rejects missing sku and disabled rules with stable codes', async () => {
  const createdResponse = await createRuleSet(
    new Request('http://localhost/api/rule-sets', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Route Simulation Rule', sourceText: '库存不得低于 20 件。', platform: 'tmall', status: 'ENABLED' }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)
  const ruleSetId = createdEnvelope.data.ruleSetId

  const missingSkuResponse = await simulateRuleSet(
    new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ skuProfileIds: ['missing_sku_for_rule_simulation'] }),
    }),
    { params: Promise.resolve({ ruleSetId }) },
  )
  const missingSkuEnvelope = await missingSkuResponse.json()
  assert.equal(missingSkuResponse.status, 404)
  assert.equal(missingSkuEnvelope.code, 'SKU.NOT_FOUND')

  await disableRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/disable`, { method: 'POST', headers: authHeaders }), { params: Promise.resolve({ ruleSetId }) })
  const disabledResponse = await simulateRuleSet(
    new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ skuProfileIds: ['missing_sku_for_rule_simulation'] }),
    }),
    { params: Promise.resolve({ ruleSetId }) },
  )
  const disabledEnvelope = await disabledResponse.json()
  assert.equal(disabledResponse.status, 409)
  assert.equal(disabledEnvelope.code, 'RULE.CONFLICT')
})

test('rule set simulation run route reads back persisted simulation by rule set', async () => {
  const externalSkuId = `rule_set_route_simulation_${Date.now()}`
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T12:00:00.000Z',
    rows: [
      {
        platform: 'tmall',
        storeId: 'rule_set_route_store',
        externalSkuId,
        productName: '规则模拟读回 SKU',
        stock: 50,
        sales30d: 200,
        positiveRate: 0.98,
        raw: { externalSkuId },
      },
    ],
  }, {
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'rule_set_route_ingest_request',
  })
  const skuProfileId = ingest.summaries[0].skuProfileId

  const createdResponse = await createRuleSet(
    new Request('http://localhost/api/rule-sets', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Route Simulation Read Rule', sourceText: '库存不得低于 20 件。', platform: 'tmall', status: 'ENABLED' }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)
  const ruleSetId = createdEnvelope.data.ruleSetId

  const simulationResponse = await simulateRuleSet(
    new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ skuProfileIds: [skuProfileId] }),
    }),
    { params: Promise.resolve({ ruleSetId }) },
  )
  const simulationEnvelope = await simulationResponse.json()
  assert.equal(simulationResponse.status, 200)
  assert.match(simulationEnvelope.data.workflowRunId, /^workflow_/)
  const simulationRunId = simulationEnvelope.data.simulationRunId

  const getResponse = await getRuleSetSimulationRun(
    new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations/${simulationRunId}`, { headers: authHeaders }),
    { params: Promise.resolve({ ruleSetId, simulationRunId }) },
  )
  const getEnvelope = await getResponse.json()
  assert.equal(getResponse.status, 200)
  assert.equal(getEnvelope.data.simulationRunId, simulationRunId)
  assert.equal(getEnvelope.data.activityRuleSetId, ruleSetId)
  assert.equal(getEnvelope.data.workflowRunId, simulationEnvelope.data.workflowRunId)
  assert.deepEqual(getEnvelope.data.scope.skuProfileIds, [skuProfileId])

  const audits = await finalApiRuntime.workflowAuditService.list({
    actorId: authHeaders['x-p0-actor-id'],
    tenantId: authHeaders['x-p0-tenant-id'],
    sessionId: authHeaders['x-p0-session-id'],
    surface: authHeaders['x-p0-surface'],
    requestId: 'rule_set_route_simulation_audit',
  }, 20)
  const audit = audits.find((item) => item.workflowRunId === simulationEnvelope.data.workflowRunId)
  assert.equal(audit?.workflowType, 'activity_simulation')
  assert.equal(audit?.output.simulationRunId, simulationRunId)

  const wrongRuleResponse = await getRuleSetSimulationRun(
    new Request(`http://localhost/api/rule-sets/wrong_rule_set/simulations/${simulationRunId}`, { headers: authHeaders }),
    { params: Promise.resolve({ ruleSetId: 'wrong_rule_set', simulationRunId }) },
  )
  const wrongRuleEnvelope = await wrongRuleResponse.json()
  assert.equal(wrongRuleResponse.status, 404)
  assert.equal(wrongRuleEnvelope.code, 'ACTIVITY_SIMULATION.NOT_FOUND')

  const deniedGetResponse = await getRuleSetSimulationRun(
    new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations/${simulationRunId}`, { headers: otherTenantHeaders }),
    { params: Promise.resolve({ ruleSetId, simulationRunId }) },
  )
  const deniedGetEnvelope = await deniedGetResponse.json()
  assert.equal(deniedGetResponse.status, 403)
  assert.equal(deniedGetEnvelope.code, 'P0.TENANT_BOUNDARY_DENIED')
})

test('rule set routes consistently return tenant boundary denial', async () => {
  const createdResponse = await createRuleSet(
    new Request('http://localhost/api/rule-sets', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: '跨租户规则边界测试', sourceText: '库存不得低于 20 件。', platform: 'tmall', status: 'ENABLED' }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)
  const ruleSetId = createdEnvelope.data.ruleSetId

  const responses = await Promise.all([
    getRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}`, { headers: otherTenantHeaders }), { params: Promise.resolve({ ruleSetId }) }),
    updateRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}`, { method: 'PATCH', headers: otherTenantHeaders, body: JSON.stringify({ name: '跨租户修改' }) }), { params: Promise.resolve({ ruleSetId }) }),
    deleteRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}`, { method: 'DELETE', headers: otherTenantHeaders }), { params: Promise.resolve({ ruleSetId }) }),
    enableRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/enable`, { method: 'POST', headers: otherTenantHeaders }), { params: Promise.resolve({ ruleSetId }) }),
    disableRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/disable`, { method: 'POST', headers: otherTenantHeaders }), { params: Promise.resolve({ ruleSetId }) }),
    listRuleSetVersions(new Request(`http://localhost/api/rule-sets/${ruleSetId}/versions`, { headers: otherTenantHeaders }), { params: Promise.resolve({ ruleSetId }) }),
    createRuleSetVersion(new Request(`http://localhost/api/rule-sets/${ruleSetId}/versions`, { method: 'POST', headers: otherTenantHeaders }), { params: Promise.resolve({ ruleSetId }) }),
    simulateRuleSet(new Request(`http://localhost/api/rule-sets/${ruleSetId}/simulations`, { method: 'POST', headers: otherTenantHeaders, body: JSON.stringify({ skuProfileIds: ['sku_cross_tenant'] }) }), { params: Promise.resolve({ ruleSetId }) }),
  ])

  for (const response of responses) {
    const envelope = await response.json()
    assert.equal(response.status, 403)
    assert.equal(envelope.code, 'P0.TENANT_BOUNDARY_DENIED')
  }
})
