import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ connectorRunId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const boundary = authContextFromRequest(request)
    const { connectorRunId } = await context.params
    const run = await finalApiRuntime.connectorService.getRun(connectorRunId, boundary)
    if (!run) return fail('CONNECTOR_RUN.NOT_FOUND', 'ConnectorRun 不存在', 404, { connectorRunId })
    return ok(run)
  } catch (error) {
    return authFail(error)
  }
}
