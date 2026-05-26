import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface ReportSubscriptionRequestDto {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'OFF'
  recipients: string[]
}

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  const payload = (await request.json().catch(() => null)) as ReportSubscriptionRequestDto | null
  if (!payload?.frequency || !Array.isArray(payload.recipients)) return fail('COMMON.VALIDATION_ERROR', 'frequency and recipients are required', 400)
  try {
    return ok(await finalApiRuntime.reportService.saveSubscription(reportId, payload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    if (error instanceof Error && !error.message.includes('Report not found')) {
      return fail('COMMON.VALIDATION_ERROR', error.message, 400, { reportId })
    }
    return fail('REPORT.NOT_FOUND', error instanceof Error ? error.message : 'Report not found', 404, { reportId })
  }
}
