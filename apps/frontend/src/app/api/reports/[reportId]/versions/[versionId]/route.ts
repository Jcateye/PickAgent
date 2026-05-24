import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ reportId: string; versionId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId, versionId } = await context.params
  const version = await finalApiRuntime.reportService.getVersion(reportId, versionId, authContextFromRequest(request))
  if (!version) return fail('REPORT.NOT_FOUND', 'Report version not found', 404, { reportId, versionId })
  return ok(version)
}
