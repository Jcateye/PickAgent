import assert from 'node:assert/strict'
import test from 'node:test'

import { DELETE as deleteRuleSet, GET as getRuleSet, PATCH as updateRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/route'
import { POST as disableRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/disable/route'
import { POST as enableRuleSet } from '../src/app/api/rule-sets/[ruleSetId]/enable/route'
import { GET as listRuleSetVersions, POST as createRuleSetVersion } from '../src/app/api/rule-sets/[ruleSetId]/versions/route'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'rule_set_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'rule_set_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'rule_set_route_request',
}

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
