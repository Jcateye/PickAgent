import { authContextFromRequest, authFail, fail, finalApiRuntime, ok, parsePositiveInt } from '../_final-api-runtime'

import type { CreateRuleSetInputDto, RuleSetListQueryDto } from '../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

const ruleSetStatuses = new Set(['ALL', 'DRAFT', 'ENABLED', 'DISABLED'])

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const query: RuleSetListQueryDto = {
      q: url.searchParams.get('q') ?? undefined,
      status: statusParam && ruleSetStatuses.has(statusParam) ? statusParam as RuleSetListQueryDto['status'] : undefined,
    }
    return ok(await finalApiRuntime.ruleSetService.list(parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20), authContextFromRequest(request), query))
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
