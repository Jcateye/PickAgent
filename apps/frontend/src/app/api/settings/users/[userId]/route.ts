import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ userId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params
  const payload = (await request.json().catch(() => null)) as { status?: unknown } | null
  const status = payload?.status === 'DISABLED' ? 'DISABLED' : payload?.status === 'ACTIVE' ? 'ACTIVE' : null
  if (!status) return fail('COMMON.VALIDATION_ERROR', 'status must be ACTIVE or DISABLED', 400, { userId })
  try {
    return ok(await finalApiRuntime.workspaceSettingsService.updateUserStatus(userId, status, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Settings user not found')) {
      return fail('SETTINGS_USER.NOT_FOUND', 'settings user not found', 404, { userId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'settings user update failed', 400, { userId })
  }
}
