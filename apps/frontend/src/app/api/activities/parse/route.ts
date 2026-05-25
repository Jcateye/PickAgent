import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import type { CanonicalRuleDto } from '../../../../../../contracts/types/businessFoundation'

interface ParseRequest {
  name: string
  platform?: string
  sourceText: string
  rules?: CanonicalRuleDto[]
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ParseRequest | null
  if (!payload?.name || !payload.sourceText) return fail('COMMON.VALIDATION_ERROR', 'name and sourceText are required', 400)
  const ruleSet = await finalApiRuntime.activityService.parse(payload, authContextFromRequest(request))
  if (ruleSet.parseStatus === 'FAILED') return fail('RULE.PARSE_FAILED', '活动规则解析失败', 422, { errors: ruleSet.errors })
  return ok(ruleSet)
}
