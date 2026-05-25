import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import type { UpdateRuleSetInputDto } from '../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import type { RuleSetStatusDto } from '../../../../../../contracts/types/businessFoundation'

type RuleSetPatchPayload = UpdateRuleSetInputDto & { status?: RuleSetStatusDto }

export async function GET(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  const detail = await finalApiRuntime.ruleSetService.get(ruleSetId, authContextFromRequest(request))
  if (!detail) return fail('RULE.PARSE_FAILED', 'rule set not found', 404, { ruleSetId })
  return ok(detail)
}

export async function PATCH(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  const payload = (await request.json().catch(() => null)) as RuleSetPatchPayload | null
  if (!payload || Object.keys(payload).length === 0) return fail('COMMON.VALIDATION_ERROR', 'at least one field is required', 400)
  const { status, ...updatePayload } = payload
  const boundary = authContextFromRequest(request)
  const hasUpdateFields = Object.keys(updatePayload).length > 0
  const updated = hasUpdateFields
    ? await finalApiRuntime.ruleSetService.update(ruleSetId, updatePayload, boundary)
    : await finalApiRuntime.ruleSetService.get(ruleSetId, boundary)
  if (!updated) return fail('RULE.PARSE_FAILED', 'rule set not found', 404, { ruleSetId })
  if (status && status !== updated.status) return ok(await finalApiRuntime.ruleSetService.setStatus(ruleSetId, status, boundary))
  return ok(updated)
}

export async function DELETE(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  return ok(await finalApiRuntime.ruleSetService.setStatus(ruleSetId, 'DISABLED', authContextFromRequest(request)))
}
