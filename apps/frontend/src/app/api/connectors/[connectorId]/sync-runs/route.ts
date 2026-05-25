import { authContextFromRequest, authFail, fail, finalApiRuntime, ok, parsePositiveInt } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ connectorId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorId } = await context.params
    const url = new URL(request.url)
    try {
      return ok(await finalApiRuntime.connectorService.listRuns(connectorId, parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20), boundary))
    } catch (error) {
      if (isConnectorNotFound(error)) return connectorNotFound(connectorId)
      throw error
    }
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
    const { connectorId } = await context.params
    if (isConnectorNotFound(error)) return connectorNotFound(connectorId)
    if (isConnectorDisabled(error)) return fail('CONNECTOR.CONFLICT', error instanceof Error ? error.message : 'Connector is disabled', 409, { connectorId })
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Connector sync run failed', 400)
  }
}

function isConnectorNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Connector not found')
}

function isConnectorDisabled(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Connector is disabled')
}

function connectorNotFound(connectorId: string) {
  return fail('CONNECTOR.NOT_FOUND', 'Connector 不存在', 404, { connectorId })
}
