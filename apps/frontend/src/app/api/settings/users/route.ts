import { authContextFromRequest, authFail, finalApiRuntime, ok } from '../../_final-api-runtime'

export async function GET(request: Request) {
  try {
    return ok(await finalApiRuntime.workspaceSettingsService.listUsers(authContextFromRequest(request)))
  } catch (error) {
    return authFail(error)
  }
}
