import { finalApiRuntime, ok, parsePositiveInt } from '../_final-api-runtime'

export async function GET(request: Request) {
  const url = new URL(request.url)
  return ok(await finalApiRuntime.ingestService.listSkus(parsePositiveInt(url.searchParams.get('page'), 1), parsePositiveInt(url.searchParams.get('pageSize'), 20)))
}
