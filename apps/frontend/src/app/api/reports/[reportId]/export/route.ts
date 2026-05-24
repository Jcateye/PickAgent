import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

interface ReportExportRequestDto {
  format: 'PDF' | 'EXCEL' | 'PPT'
  idempotencyKey?: string
}

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  const payload = (await request.json().catch(() => null)) as ReportExportRequestDto | null
  if (!payload?.format) return fail('COMMON.VALIDATION_ERROR', 'format is required', 400)
  return ok(await finalApiRuntime.reportService.export(reportId, payload, authContextFromRequest(request)))
}
