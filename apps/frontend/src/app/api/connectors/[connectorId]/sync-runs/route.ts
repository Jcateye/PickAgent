import { authContextFromRequest, authFail, fail, finalApiRuntime, ok, parsePositiveInt } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ connectorId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorId } = await context.params
    const url = new URL(request.url)
    return ok(await finalApiRuntime.connectorService.listRuns(connectorId, parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20), boundary))
  } catch (error) {
    return authFail(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorId } = await context.params
    const payload = (await request.json().catch(() => ({}))) ?? {}
    return ok(await finalApiRuntime.connectorService.createSyncRun(connectorId, payload, boundary))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Connector sync run failed', 400)
  }
}
