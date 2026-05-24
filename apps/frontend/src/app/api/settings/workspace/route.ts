import { authContextFromRequest, finalApiRuntime, ok } from '../../_final-api-runtime'

export async function GET(request: Request) {
  return ok(await finalApiRuntime.workspaceSettingsService.getWorkspace(authContextFromRequest(request)))
}

export async function PATCH(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
  return ok(await finalApiRuntime.workspaceSettingsService.updateWorkspace(payload, authContextFromRequest(request)))
}
