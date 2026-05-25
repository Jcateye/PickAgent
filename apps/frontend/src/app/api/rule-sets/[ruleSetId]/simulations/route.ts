import { fail, finalApiRuntime, ok, p0AuthContext } from '../../../_final-api-runtime'

import type { SimulationRequestDto } from '../../../../../../../contracts/types/businessFoundation'

export async function POST(request: Request, context: { params: Promise<{ ruleSetId: string }> }) {
  const boundary = p0AuthContext(request)
  const { ruleSetId } = await context.params
  const payload = (await request.json().catch(() => null)) as Omit<SimulationRequestDto, 'ruleSetId'> | null
  if (!payload?.skuProfileIds?.length) return fail('COMMON.VALIDATION_ERROR', 'skuProfileIds is required', 400, undefined, boundary.requestId)
  try {
    return ok(await finalApiRuntime.activityService.simulate(ruleSetId, payload, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('SKU detail not found for simulation')) {
      return fail('SKU.NOT_FOUND', error.message, 404, { ruleSetId }, boundary.requestId)
    }
    if (error instanceof Error && error.message.includes('Rule set is disabled')) {
      return fail('RULE.CONFLICT', error.message, 409, { ruleSetId }, boundary.requestId)
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'rule set simulation failed', 400, { ruleSetId }, boundary.requestId)
  }
}
