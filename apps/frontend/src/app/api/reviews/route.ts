import { fail, finalApiRuntime, ok } from '../_final-api-runtime'

import type { ReviewItemDto } from '../../../../../contracts/types/businessFoundation'

export async function GET() {
  return ok(finalApiRuntime.reviewService.list())
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { items?: Array<Omit<ReviewItemDto, 'reviewItemId' | 'status'>> } | null
  if (!payload?.items?.length) return fail('COMMON.VALIDATION_ERROR', 'items is required', 400)
  try {
    return ok(finalApiRuntime.reviewService.create(payload.items))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Review item creation failed', 400)
  }
}
