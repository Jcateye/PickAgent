import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

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
  return ok(await finalApiRuntime.reportService.saveSubscription(reportId, payload, authContextFromRequest(request)))
}
