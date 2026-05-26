import { fail, finalApiRuntime, requireApiAuthContext } from '../../../_final-api-runtime'
import { parseSkuListQuery } from '../../sku-list-query'

const downloadBoundary = {
  actorId: 'frontend_console',
  tenantId: 'dev_tenant',
  sessionId: 'frontend_session',
  surface: 'frontend-console-download',
  requestId: 'sku_export_download',
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = parseSkuListQuery(url.searchParams)
  if (!query) return fail('COMMON.VALIDATION_ERROR', 'SKU 导出下载查询参数不合法', 400)
  try {
    const boundary = request.headers.get('x-p0-tenant-id') ? requireApiAuthContext(request) : downloadBoundary
    const exported = await finalApiRuntime.skuReadinessQueryService.buildExportArtifact(query, boundary)
    return new Response(exported.csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${exported.fileName}"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'SKU export download failed', 400)
  }
}
