import { authContextFromRequest, fail, ok } from '../../../_final-api-runtime'
import { buildRunConsoleLogExport } from '../../run-console-data'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const requestId = request.headers.get('x-request-id') ?? undefined
  const exported = await buildRunConsoleLogExport(authContextFromRequest(request), runId)
  if (!exported) return fail('RUN_CONSOLE.NOT_FOUND', 'Run 不存在或不在当前租户可见范围内', 404, { runId }, requestId)
  return ok(exported, requestId)
}
