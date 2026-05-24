import { authContextFromRequest, finalApiRuntime, ok } from '../../../_final-api-runtime'

export async function GET(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  return ok(await finalApiRuntime.ruleSetService.listVersions(ruleSetId, authContextFromRequest(request)))
}

export async function POST(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const { ruleSetId } = await context.params
  return ok(await finalApiRuntime.ruleSetService.createVersion(ruleSetId, authContextFromRequest(request)))
}
