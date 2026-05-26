import { authContextFromRequest, authFail, fail, finalApiRuntime, ok, parsePositiveInt } from '../_final-api-runtime'

import type { CreateRuleSetInputDto } from '../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    return ok(await finalApiRuntime.ruleSetService.list(parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20), authContextFromRequest(request)))
  } catch (error) {
    return authFail(error)
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as CreateRuleSetInputDto | null
    if (!payload?.name || !payload.sourceText) return fail('COMMON.VALIDATION_ERROR', 'name and sourceText are required', 400)
    return ok(await finalApiRuntime.ruleSetService.create(payload, authContextFromRequest(request)))
  } catch (error) {
    return authFail(error)
  }
}
