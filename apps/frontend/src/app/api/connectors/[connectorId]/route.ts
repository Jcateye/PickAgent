import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ connectorId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorId } = await context.params
    const connector = await finalApiRuntime.connectorService.get(connectorId, boundary)
    if (!connector) return fail('CONNECTOR.NOT_FOUND', 'Connector 不存在', 404, { connectorId })
    return ok(connector)
  } catch (error) {
    return authFail(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorId } = await context.params
    const payload = await request.json().catch(() => null)
    if (!payload) return fail('COMMON.VALIDATION_ERROR', 'Invalid JSON payload', 400)
    return ok(await finalApiRuntime.connectorService.update(connectorId, payload, boundary))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Connector update failed', 400)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorId } = await context.params
    return ok(await finalApiRuntime.connectorService.update(connectorId, { status: 'DISABLED' }, boundary))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Connector disable failed', 400)
  }
}
