import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

export async function POST(request: Request) {
  try {
    authContextFromRequest(request)
    const payload = await request.json().catch(() => null)
    if (!payload?.url) return fail('COMMON.VALIDATION_ERROR', 'url is required', 400)
    return ok(finalApiRuntime.browserConnectorService.detectPage(payload))
  } catch (error) {
    return authFail(error)
  }
}
