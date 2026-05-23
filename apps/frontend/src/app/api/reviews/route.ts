import { finalApiRuntime, ok } from '../_final-api-runtime'

export async function GET() {
  return ok(finalApiRuntime.reviewService.list())
}
