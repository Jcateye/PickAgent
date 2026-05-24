import { authContextFromRequest, finalApiRuntime, ok } from '../../../_final-api-runtime'

export async function POST(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  return ok(await finalApiRuntime.ruleSetService.setStatus(ruleSetId, 'DISABLED', authContextFromRequest(request)))
}
