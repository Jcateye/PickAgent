import { fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

import type { SimulationRequestDto } from '../../../../../../../contracts/types/businessFoundation'

interface RouteContext {
  params: Promise<{ activityRuleSetId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { activityRuleSetId } = await context.params
  const payload = (await request.json().catch(() => null)) as Omit<SimulationRequestDto, 'ruleSetId'> | null
  if (!payload?.skuProfileIds?.length) return fail('COMMON.VALIDATION_ERROR', 'skuProfileIds is required', 400)
  try {
    return ok(finalApiRuntime.activityService.simulate(activityRuleSetId, payload))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Simulation failed', 400)
  }
}
