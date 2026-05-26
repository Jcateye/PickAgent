import { authContextFromRequest, authFail, fail, finalApiRuntime, ok, parsePositiveInt } from '../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { ReviewItemDto } from '../../../../../contracts/types/businessFoundation'
import type { ReviewListQueryDto } from '../../../../../contracts/types/reviewReportCenter'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query: ReviewListQueryDto = {
      page: parsePositiveInt(url.searchParams.get('page'), 1),
      pageSize: parsePositiveInt(url.searchParams.get('pageSize'), 20),
      tab: (url.searchParams.get('tab') || undefined) as ReviewListQueryDto['tab'],
      type: (url.searchParams.get('type') || undefined) as ReviewListQueryDto['type'],
      riskLevel: (url.searchParams.get('riskLevel') || undefined) as ReviewListQueryDto['riskLevel'],
      status: url.searchParams.get('status') || undefined,
      assigneeRole: url.searchParams.get('assigneeRole') || undefined,
      dueFrom: url.searchParams.get('dueFrom') || undefined,
      dueTo: url.searchParams.get('dueTo') || undefined,
      q: url.searchParams.get('q') || undefined
    }
    return ok(await finalApiRuntime.reviewService.list(query, authContextFromRequest(request)))
  } catch (error) {
    return authFail(error)
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { items?: Array<Omit<ReviewItemDto, 'reviewItemId' | 'status'>> } | null
  if (!payload?.items?.length) return fail('COMMON.VALIDATION_ERROR', 'items is required', 400)
  try {
    return ok(await finalApiRuntime.reviewService.create(payload.items, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Review item creation failed', 400)
  }
}
