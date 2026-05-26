import { ok } from '../../../_final-api-runtime'
import { getRealAgentChatReadiness } from '../route'

export async function GET() {
  return ok(getRealAgentChatReadiness())
}
