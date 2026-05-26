import { authContextFromRequest, authFail, ok, parsePositiveInt } from '../_final-api-runtime'
import { buildRunConsolePage } from './run-console-data'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 50), 100)
    return ok(await buildRunConsolePage(authContextFromRequest(request), limit))
  } catch (error) {
    return authFail(error)
  }
}
