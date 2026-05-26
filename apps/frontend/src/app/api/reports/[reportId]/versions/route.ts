import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  try {
    return ok(await finalApiRuntime.reportService.listVersions(reportId, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('REPORT.NOT_FOUND', error instanceof Error ? error.message : 'Report not found', 404, { reportId })
  }
}
