import { fail, finalApiRuntime, ok, p0AuthContext } from '../../../../_final-api-runtime'

import type { ParseActivityRuleSetRequestDto } from '../../../../../../../../contracts/types/activityManagement'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  const payload = (await request.json().catch(() => null)) as ParseActivityRuleSetRequestDto | null
  if (!payload?.sourceText) return fail('COMMON.VALIDATION_ERROR', 'sourceText is required', 400, undefined, boundary.requestId)
  try {
    return ok(await finalApiRuntime.activityService.parseForActivity(activityId, payload, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Activity not found')) {
      return fail('ACTIVITY.NOT_FOUND', 'activity not found', 404, { activityId }, boundary.requestId)
    }
    return fail('RULE.PARSE_FAILED', error instanceof Error ? error.message : 'activity rule parse failed', 422, { activityId }, boundary.requestId)
  }
}
