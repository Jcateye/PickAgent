import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { UpdateRuleSetInputDto } from '../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

export async function GET(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  try {
    const detail = await finalApiRuntime.ruleSetService.get(ruleSetId, authContextFromRequest(request))
    if (!detail) return ruleSetNotFound(ruleSetId)
    return ok(detail)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    if (isRuleSetNotFound(error)) return ruleSetNotFound(ruleSetId)
    throw error
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  const payload = (await request.json().catch(() => null)) as UpdateRuleSetInputDto | null
  if (!payload || Object.keys(payload).length === 0) return fail('COMMON.VALIDATION_ERROR', 'at least one field is required', 400)
  try {
    return ok(await finalApiRuntime.ruleSetService.update(ruleSetId, payload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    if (isRuleSetNotFound(error)) return ruleSetNotFound(ruleSetId)
    throw error
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  try {
    return ok(await finalApiRuntime.ruleSetService.setStatus(ruleSetId, 'DISABLED', authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    if (isRuleSetNotFound(error)) return ruleSetNotFound(ruleSetId)
    throw error
  }
}

function isRuleSetNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Rule set not found')
}

function ruleSetNotFound(ruleSetId: string) {
  return fail('RULE.NOT_FOUND', 'rule set not found', 404, { ruleSetId })
}
