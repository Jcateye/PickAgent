import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  const detail = await finalApiRuntime.reportService.getDetail(reportId, authContextFromRequest(request))
  if (!detail) return fail('REPORT.NOT_FOUND', 'Report not found', 404, { reportId })
  return ok(detail)
}
