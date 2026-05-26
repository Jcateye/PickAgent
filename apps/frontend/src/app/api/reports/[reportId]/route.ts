import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  try {
    const detail = await finalApiRuntime.reportService.getDetail(reportId, authContextFromRequest(request))
    if (!detail) return fail('REPORT.NOT_FOUND', 'Report not found', 404, { reportId })
    return ok(detail)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    return fail('REPORT.NOT_FOUND', error instanceof Error ? error.message : 'Report not found', 404, { reportId })
  }
}
