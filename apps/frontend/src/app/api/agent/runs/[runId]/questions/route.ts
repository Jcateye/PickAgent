import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const payload = (await request.json().catch(() => null)) as { question?: string; askedBy?: string | null } | null
  if (!payload?.question?.trim()) return fail('COMMON.VALIDATION_ERROR', 'question is required', 400, { runId })
  try {
    return ok(finalAgentRuntime.agentService.answerQuestion(runId, { question: payload.question, askedBy: payload.askedBy }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Agent run not found')) {
      return fail('AGENT_RUN.NOT_FOUND', error.message, 404, { runId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent run question failed', 400, { runId })
  }
}
