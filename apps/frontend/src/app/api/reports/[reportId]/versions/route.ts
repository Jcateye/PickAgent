import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  try {
    return ok(await finalApiRuntime.reportService.listVersions(reportId, authContextFromRequest(request)))
  } catch (error) {
    return fail('REPORT.NOT_FOUND', error instanceof Error ? error.message : 'Report not found', 404, { reportId })
  }
}
