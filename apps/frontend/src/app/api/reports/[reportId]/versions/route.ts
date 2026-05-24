import { authContextFromRequest, finalApiRuntime, ok } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  return ok(await finalApiRuntime.reportService.listVersions(reportId, authContextFromRequest(request)))
}
