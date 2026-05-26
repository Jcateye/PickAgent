import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

export async function POST(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  try {
    return ok(await finalApiRuntime.ruleSetService.setStatus(ruleSetId, 'DISABLED', authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    if (error instanceof Error && error.message.includes('Rule set not found')) {
      return fail('RULE.NOT_FOUND', 'rule set not found', 404, { ruleSetId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'rule set disable failed', 400, { ruleSetId })
  }
}
