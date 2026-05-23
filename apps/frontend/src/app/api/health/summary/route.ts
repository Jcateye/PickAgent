import { finalApiRuntime, ok } from '../../_final-api-runtime'

export async function GET() {
  return ok(await finalApiRuntime.ingestService.getHealthSummary())
}
