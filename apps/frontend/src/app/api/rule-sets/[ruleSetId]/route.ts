import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import type { UpdateRuleSetInputDto } from '../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

export async function GET(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  const detail = await finalApiRuntime.ruleSetService.get(ruleSetId, authContextFromRequest(request))
  if (!detail) return fail('RULE.PARSE_FAILED', 'rule set not found', 404, { ruleSetId })
  return ok(detail)
}

export async function PATCH(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  const payload = (await request.json().catch(() => null)) as UpdateRuleSetInputDto | null
  if (!payload || Object.keys(payload).length === 0) return fail('COMMON.VALIDATION_ERROR', 'at least one field is required', 400)
  return ok(await finalApiRuntime.ruleSetService.update(ruleSetId, payload, authContextFromRequest(request)))
}
