import assert from 'node:assert/strict'
import test from 'node:test'

import { POST as createActivity } from '../src/app/api/activities/route'
import { GET as getActivity, PATCH as updateActivity } from '../src/app/api/activities/[activityId]/route'
import { GET as getExecutionPlan } from '../src/app/api/activities/[activityId]/execution-plan/route'
import { POST as startActivityRun } from '../src/app/api/activities/[activityId]/runs/route'
import { POST as parseActivityRuleSet } from '../src/app/api/activities/[activityId]/rule-sets/parse/route'
import { GET as getSimulationRun } from '../src/app/api/activities/[activityId]/simulations/[simulationRunId]/route'
import { POST as createSimulationRun } from '../src/app/api/activities/[activityId]/simulations/route'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'activity_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'activity_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'activity_route_request',
}

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
