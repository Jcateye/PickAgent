import { authFail, fail, finalApiRuntime, ok, p0AuthContext, parsePositiveInt } from '../_final-api-runtime'

import type { CreateActivityRequestDto } from '../../../../../contracts/types/activityManagement'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const boundary = p0AuthContext(request)
    return ok(await finalApiRuntime.activityService.list(parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20), boundary), boundary.requestId)
  } catch (error) {
    return authFail(error)
  }
}

export async function POST(request: Request) {
  try {
    const boundary = p0AuthContext(request)
    const payload = (await request.json().catch(() => null)) as CreateActivityRequestDto | null
    if (!payload?.name) return fail('COMMON.VALIDATION_ERROR', 'name is required', 400, undefined, boundary.requestId)
    return ok(await finalApiRuntime.activityService.create(payload, boundary), boundary.requestId)
  } catch (error) {
    return authFail(error)
  }
}
