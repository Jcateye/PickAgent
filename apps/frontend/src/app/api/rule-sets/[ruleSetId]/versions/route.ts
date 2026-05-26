import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

export async function GET(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  try {
    return ok(await finalApiRuntime.ruleSetService.listVersions(ruleSetId, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    if (error instanceof Error && error.message.includes('Rule set not found')) {
      return fail('RULE.NOT_FOUND', 'rule set not found', 404, { ruleSetId })
    }
    throw error
  }
}

export async function POST(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  try {
    return ok(await finalApiRuntime.ruleSetService.createVersion(ruleSetId, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    if (error instanceof Error && error.message.includes('Rule set not found')) {
      return fail('RULE.NOT_FOUND', 'rule set not found', 404, { ruleSetId })
    }
    throw error
  }
}
