import { authContextFromRequest, finalApiRuntime, ok } from '../../_final-api-runtime'

export async function GET(request: Request) {
  return ok(await finalApiRuntime.workspaceSettingsService.listUsers(authContextFromRequest(request)))
}
