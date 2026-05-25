import { fail, finalApiRuntime, ok, requireApiAuthContext } from '../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { UpdateSkuNextActionInputDto } from '../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

interface RouteContext {
  params: Promise<{ skuProfileId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { skuProfileId } = await context.params
  const requestId = request.headers.get('x-request-id') ?? undefined
  try {
    const detail = await finalApiRuntime.skuReadinessQueryService.detail(skuProfileId, requireApiAuthContext(request, requestId))
    if (!detail) return fail('SKU.NOT_FOUND', 'SKU 不存在', 404, { skuProfileId }, requestId)
    return ok(detail, requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit, requestId)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'SKU detail failed', 400, { skuProfileId }, requestId)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { skuProfileId } = await context.params
  const requestId = request.headers.get('x-request-id') ?? undefined
  const payload = await request.json().catch(() => null)
  const input = parseUpdateNextActionInput(payload)
  if (!input) return fail('COMMON.VALIDATION_ERROR', '下一步设置参数不合法', 400, undefined, requestId)
  try {
    const detail = await finalApiRuntime.skuReadinessQueryService.updateNextAction(skuProfileId, input, requireApiAuthContext(request, requestId))
    return ok(detail, requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit, requestId)
    if (error instanceof Error && error.message === 'SKU not found') return fail('SKU.NOT_FOUND', 'SKU 不存在', 404, { skuProfileId }, requestId)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'SKU next action update failed', 400, { skuProfileId }, requestId)
  }
}

function parseUpdateNextActionInput(value: unknown): UpdateSkuNextActionInputDto | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const nextAction = record.nextAction
  if (!nextAction || typeof nextAction !== 'object') return null
  const actionRecord = nextAction as Record<string, unknown>
  const type = actionRecord.type
  const label = actionRecord.label
  if (!isNextActionType(type) || typeof label !== 'string' || !label.trim()) return null
  return {
    nextAction: {
      type,
      label: label.trim(),
      disabled: typeof actionRecord.disabled === 'boolean' ? actionRecord.disabled : undefined,
    },
    comment: typeof record.comment === 'string' ? record.comment : undefined,
  }
}

function isNextActionType(value: unknown): value is UpdateSkuNextActionInputDto['nextAction']['type'] {
  return value === 'JOIN_ACTIVITY' || value === 'REPAIR_ISSUE' || value === 'VIEW_DETAIL' || value === 'VIEW_BLOCKER' || value === 'MANUAL_REVIEW'
}
