import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

export async function POST(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  try {
    return ok(await finalApiRuntime.ruleSetService.setStatus(ruleSetId, 'DISABLED', authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rule set not found')) {
      return fail('RULE.NOT_FOUND', 'rule set not found', 404, { ruleSetId })
    }
    throw error
  }
}
