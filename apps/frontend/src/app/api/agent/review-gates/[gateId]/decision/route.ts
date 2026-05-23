import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ gateId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { gateId } = await context.params
  const payload = (await request.json().catch(() => null)) as { decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; decidedBy?: string; decisionComment?: string } | null
  if (!payload?.decision || !payload.decidedBy) return fail('COMMON.VALIDATION_ERROR', 'decision and decidedBy are required', 400)
  try {
    return ok(finalAgentRuntime.agentService.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment }))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent review gate decision failed', 400, { gateId })
  }
}
