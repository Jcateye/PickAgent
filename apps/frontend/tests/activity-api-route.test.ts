import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as fetchActivityList, POST as createActivity } from '../src/app/api/activities/route'
import { GET as getActivity, PATCH as updateActivity } from '../src/app/api/activities/[activityId]/route'
import { GET as getExecutionPlan } from '../src/app/api/activities/[activityId]/execution-plan/route'
import { POST as addCandidateSkus } from '../src/app/api/activities/[activityId]/candidate-skus/route'
import { POST as startActivityRun } from '../src/app/api/activities/[activityId]/runs/route'
import { POST as parseActivityRuleSet } from '../src/app/api/activities/[activityId]/rule-sets/parse/route'
import { GET as getSimulationRun } from '../src/app/api/activities/[activityId]/simulations/[simulationRunId]/route'
import { POST as createSimulationRun } from '../src/app/api/activities/[activityId]/simulations/route'
import { POST as parseStandaloneRules } from '../src/app/api/activities/parse/route'
import { finalApiRuntime } from '../src/app/api/_final-api-runtime'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'activity_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'activity_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'activity_route_request',
}

const otherTenantHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'activity_route_other_tenant',
  'x-p0-tenant-id': 'other_tenant',
  'x-p0-session-id': 'activity_route_other_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'activity_route_other_request',
}

test('activity root and standalone parse routes return stable auth envelopes when P0 context is missing', async () => {
  const responses = await Promise.all([
    fetchActivityList(new Request('http://localhost/api/activities')),
    createActivity(new Request('http://localhost/api/activities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing Auth Activity', platform: 'tmall' }),
    })),
    parseStandaloneRules(new Request('http://localhost/api/activities/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing Auth Parse', platform: 'tmall', sourceText: '库存不得低于 20 件。' }),
    })),
  ])

  for (const response of responses) {
    const envelope = await response.json()
    assert.equal(response.status, 401)
    assert.equal(envelope.code, 'COMMON.VALIDATION_ERROR')
  }
})

test('standalone activity rule parse route returns workflow run id for audit navigation', async () => {
  const beforeIds = new Set(Array.from(finalApiRuntime.store.workflowAudits.keys()))
  const response = await parseStandaloneRules(
    new Request('http://localhost/api/activities/parse', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Route Standalone Parse Rule', platform: 'tmall', sourceText: '库存不得低于 20 件。' }),
    }),
  )
  const envelope = await response.json()
  assert.equal(response.status, 200)
  assert.match(envelope.data.workflowRunId, /^workflow_/)

  const newAudits = Array.from(finalApiRuntime.store.workflowAudits.entries())
    .filter(([workflowRunId]) => !beforeIds.has(workflowRunId))
    .map(([, audit]) => audit)
  const audit = newAudits.find((item) => item.workflowRunId === envelope.data.workflowRunId)
  assert.equal(audit?.workflowType, 'activity_rule_parse')
  assert.equal(audit?.subjectId, envelope.data.ruleSetId)
})

test('activity routes return not found for missing activity reads and writes', async () => {
  const params = { params: Promise.resolve({ activityId: 'missing_activity' }) }

  const getResponse = await getActivity(new Request('http://localhost/api/activities/missing_activity', { headers: authHeaders }), params)
  const getEnvelope = await getResponse.json()
  assert.equal(getResponse.status, 404)
  assert.equal(getEnvelope.code, 'ACTIVITY.NOT_FOUND')

  const updateResponse = await updateActivity(
    new Request('http://localhost/api/activities/missing_activity', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'RUNNING' }),
    }),
    params,
  )
  const updateEnvelope = await updateResponse.json()
  assert.equal(updateResponse.status, 404)
  assert.equal(updateEnvelope.code, 'ACTIVITY.NOT_FOUND')

  const planResponse = await getExecutionPlan(new Request('http://localhost/api/activities/missing_activity/execution-plan', { headers: authHeaders }), params)
  const planEnvelope = await planResponse.json()
  assert.equal(planResponse.status, 404)
  assert.equal(planEnvelope.code, 'ACTIVITY.NOT_FOUND')

  const runResponse = await startActivityRun(new Request('http://localhost/api/activities/missing_activity/runs', { method: 'POST', headers: authHeaders }), params)
  const runEnvelope = await runResponse.json()
  assert.equal(runResponse.status, 404)
  assert.equal(runEnvelope.code, 'ACTIVITY.NOT_FOUND')
})

test('activity rule parse and simulation routes preserve activity missing and conflict semantics', async () => {
  const missingParams = { params: Promise.resolve({ activityId: 'missing_activity_for_flow' }) }

  const parseResponse = await parseActivityRuleSet(
    new Request('http://localhost/api/activities/missing_activity_for_flow/rule-sets/parse', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ sourceText: '报名活动前库存必须大于 10' }),
    }),
    missingParams,
  )
  const parseEnvelope = await parseResponse.json()
  assert.equal(parseResponse.status, 404)
  assert.equal(parseEnvelope.code, 'ACTIVITY.NOT_FOUND')

  const missingSimulationResponse = await createSimulationRun(
    new Request('http://localhost/api/activities/missing_activity_for_flow/simulations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ skuProfileIds: ['sku_missing'] }),
    }),
    missingParams,
  )
  const missingSimulationEnvelope = await missingSimulationResponse.json()
  assert.equal(missingSimulationResponse.status, 404)
  assert.equal(missingSimulationEnvelope.code, 'ACTIVITY.NOT_FOUND')

  const createdResponse = await createActivity(
    new Request('http://localhost/api/activities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: `Activity Without Rule ${Date.now()}`, platform: 'tmall' }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)

  const conflictResponse = await createSimulationRun(
    new Request(`http://localhost/api/activities/${createdEnvelope.data.activityId}/simulations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ skuProfileIds: ['sku_missing'] }),
    }),
    { params: Promise.resolve({ activityId: createdEnvelope.data.activityId }) },
  )
  const conflictEnvelope = await conflictResponse.json()
  assert.equal(conflictResponse.status, 409)
  assert.equal(conflictEnvelope.code, 'ACTIVITY.CONFLICT')
})

test('activity simulation detail route returns simulation not found code', async () => {
  const response = await getSimulationRun(
    new Request('http://localhost/api/activities/missing_activity/simulations/missing_run', { headers: authHeaders }),
    { params: Promise.resolve({ activityId: 'missing_activity', simulationRunId: 'missing_run' }) },
  )
  const envelope = await response.json()

  assert.equal(response.status, 404)
  assert.equal(envelope.code, 'ACTIVITY_SIMULATION.NOT_FOUND')
})

test('activity candidate sku route persists candidate list and workflow audit', async () => {
  const externalSkuId = `activity_candidate_sku_${Date.now()}`
  const ingest = await finalApiRuntime.ingestService.ingest({
    collectedAt: '2026-05-26T12:00:00.000Z',
    rows: [{
      platform: 'tmall',
      storeId: 'activity_candidate_store',
      externalSkuId,
      productName: '活动候选 SKU',
      stock: 50,
      positiveRate: 0.98,
      raw: { externalSkuId },
    }],
  }, {
    actorId: 'activity_route_tester',
    tenantId: 'dev_tenant',
    sessionId: 'activity_route_session',
    surface: 'route-test',
    requestId: 'activity_candidate_ingest',
  })
  const skuProfileId = ingest.summaries[0].skuProfileId
  const createdResponse = await createActivity(
    new Request('http://localhost/api/activities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: `Activity Candidate ${Date.now()}`, platform: 'tmall' }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  const activityId = createdEnvelope.data.activityId

  const response = await addCandidateSkus(
    new Request(`http://localhost/api/activities/${activityId}/candidate-skus`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ skuProfileIds: [skuProfileId], reasonCode: 'route-test', comment: '加入候选清单，不执行平台报名' }),
    }),
    { params: Promise.resolve({ activityId }) },
  )
  const envelope = await response.json()
  assert.equal(response.status, 200)
  assert.equal(envelope.code, 'OK')
  assert.deepEqual(envelope.data.addedSkuProfileIds, [skuProfileId])
  assert.deepEqual(envelope.data.skuProfileIds, [skuProfileId])
  assert.match(envelope.data.workflowRunId, /^workflow_/)

  const page = await finalApiRuntime.activityService.list(1, 20, {
    actorId: 'activity_route_tester',
    tenantId: 'dev_tenant',
    sessionId: 'activity_route_session',
    surface: 'route-test',
    requestId: 'activity_candidate_list',
  })
  const activity = page.items.find((item) => item.activityId === activityId)
  assert.deepEqual(activity?.candidateSkuProfileIds, [skuProfileId])

  const planResponse = await getExecutionPlan(
    new Request(`http://localhost/api/activities/${activityId}/execution-plan`, { headers: authHeaders }),
    { params: Promise.resolve({ activityId }) },
  )
  const planEnvelope = await planResponse.json()
  assert.equal(planResponse.status, 200)
  assert.deepEqual(planEnvelope.data.candidateSkuProfileIds, [skuProfileId])

  const audits = await finalApiRuntime.workflowAuditService.list({
    actorId: 'activity_route_tester',
    tenantId: 'dev_tenant',
    sessionId: 'activity_route_session',
    surface: 'route-test',
    requestId: 'activity_candidate_audit',
  }, 20)
  const audit = audits.find((item) => item.workflowRunId === envelope.data.workflowRunId)
  assert.equal(audit?.workflowType, 'activity_candidate_skus')
  assert.equal(audit?.subjectId, activityId)
})

test('activity routes consistently return tenant boundary denial', async () => {
  const createdResponse = await createActivity(
    new Request('http://localhost/api/activities', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: `Activity Boundary ${Date.now()}`, platform: 'tmall' }),
    }),
  )
  const createdEnvelope = await createdResponse.json()
  assert.equal(createdResponse.status, 200)
  const activityId = createdEnvelope.data.activityId

  const responses = await Promise.all([
    getActivity(new Request(`http://localhost/api/activities/${activityId}`, { headers: otherTenantHeaders }), { params: Promise.resolve({ activityId }) }),
    updateActivity(new Request(`http://localhost/api/activities/${activityId}`, { method: 'PATCH', headers: otherTenantHeaders, body: JSON.stringify({ status: 'RUNNING' }) }), { params: Promise.resolve({ activityId }) }),
    getExecutionPlan(new Request(`http://localhost/api/activities/${activityId}/execution-plan`, { headers: otherTenantHeaders }), { params: Promise.resolve({ activityId }) }),
    startActivityRun(new Request(`http://localhost/api/activities/${activityId}/runs`, { method: 'POST', headers: otherTenantHeaders }), { params: Promise.resolve({ activityId }) }),
    parseActivityRuleSet(new Request(`http://localhost/api/activities/${activityId}/rule-sets/parse`, { method: 'POST', headers: otherTenantHeaders, body: JSON.stringify({ sourceText: '库存不得低于 20 件。' }) }), { params: Promise.resolve({ activityId }) }),
    createSimulationRun(new Request(`http://localhost/api/activities/${activityId}/simulations`, { method: 'POST', headers: otherTenantHeaders, body: JSON.stringify({ skuProfileIds: ['sku_cross_tenant'] }) }), { params: Promise.resolve({ activityId }) }),
    addCandidateSkus(new Request(`http://localhost/api/activities/${activityId}/candidate-skus`, { method: 'POST', headers: otherTenantHeaders, body: JSON.stringify({ skuProfileIds: ['sku_cross_tenant'] }) }), { params: Promise.resolve({ activityId }) }),
  ])

  for (const response of responses) {
    const envelope = await response.json()
    assert.equal(response.status, 403)
    assert.equal(envelope.code, 'P0.TENANT_BOUNDARY_DENIED')
  }
})
