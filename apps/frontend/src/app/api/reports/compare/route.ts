import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { baseReportId?: string; targetReportId?: string } | null
  const baseReportId = payload?.baseReportId?.trim()
  const targetReportId = payload?.targetReportId?.trim()
  if (!baseReportId || !targetReportId) return fail('COMMON.VALIDATION_ERROR', 'baseReportId and targetReportId are required', 400)
  if (baseReportId === targetReportId) return fail('COMMON.VALIDATION_ERROR', 'baseReportId and targetReportId must be different', 400)
  try {
    return ok(await finalApiRuntime.reportService.compare(baseReportId, targetReportId, authContextFromRequest(request)))
  } catch (error) {
    return fail('REPORT.NOT_FOUND', error instanceof Error ? error.message : 'Report not found', 404, { baseReportId, targetReportId })
  }
}
