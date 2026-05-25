import { authFail, finalApiRuntime, ok, requireApiAuthContext } from '../../_final-api-runtime'

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? undefined
  try {
    return ok(await finalApiRuntime.ingestService.getHealthSummary(requireApiAuthContext(request, requestId)), requestId)
  } catch (error) {
    return authFail(error)
  }
}
