import { authContextFromRequest, authFail, fail, finalApiRuntime, ok, parsePositiveInt } from '../_final-api-runtime'

export async function GET(request: Request) {
  try {
    const boundary = authContextFromRequest(request)
    const url = new URL(request.url)
    return ok(await finalApiRuntime.connectorService.list(parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20), boundary))
  } catch (error) {
    return authFail(error)
  }
}

export async function POST(request: Request) {
  try {
    const boundary = authContextFromRequest(request)
    const payload = await request.json().catch(() => null)
    if (!payload) return fail('COMMON.VALIDATION_ERROR', 'Invalid JSON payload', 400)
    return ok(await finalApiRuntime.connectorService.create(payload, boundary))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Connector creation failed', 400)
  }
}
