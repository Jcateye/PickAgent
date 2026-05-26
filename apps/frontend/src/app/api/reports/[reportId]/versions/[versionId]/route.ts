import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface RouteContext {
  params: Promise<{ reportId: string; versionId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId, versionId } = await context.params
  try {
    const version = await finalApiRuntime.reportService.getVersion(reportId, versionId, authContextFromRequest(request))
    if (!version) return fail('REPORT.NOT_FOUND', 'Report version not found', 404, { reportId, versionId })
    return ok(version)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('REPORT.NOT_FOUND', error instanceof Error ? error.message : 'Report version not found', 404, { reportId, versionId })
  }
}
