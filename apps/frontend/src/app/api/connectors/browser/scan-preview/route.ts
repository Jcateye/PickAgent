import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

export async function POST(request: Request) {
  try {
    authContextFromRequest(request)
    const payload = await request.json().catch(() => null)
    if (!payload?.url || !Array.isArray(payload.rows)) return fail('COMMON.VALIDATION_ERROR', 'url and rows are required', 400)
    return ok(finalApiRuntime.browserConnectorService.scanPreview(payload))
  } catch (error) {
    return authFail(error)
  }
}
