import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

export async function GET(request: Request) {
  try {
    return ok(await finalApiRuntime.workspaceSettingsService.getWorkspace(authContextFromRequest(request)))
  } catch (error) {
    return authFail(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return ok(await finalApiRuntime.workspaceSettingsService.updateWorkspace(payload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'workspace settings update failed', 400)
  }
}
