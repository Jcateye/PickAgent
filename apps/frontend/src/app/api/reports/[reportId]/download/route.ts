import type { ReportDetailDto, ReportExportRequestDto } from '../../../../../../../contracts/types/reviewReportCenter'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import { authContextFromRequest, fail, finalApiRuntime } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ reportId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params
  const url = new URL(request.url)
  const exportJobId = url.searchParams.get('exportJobId')
  const format = url.searchParams.get('format')
  if (!exportJobId) return fail('COMMON.VALIDATION_ERROR', 'exportJobId is required', 400, { reportId })
  if (!isReportExportFormat(format)) return fail('COMMON.VALIDATION_ERROR', 'format must be PDF, EXCEL, or PPT', 400, { reportId })

  let detail: ReportDetailDto | null
  try {
    detail = await finalApiRuntime.reportService.getDetail(reportId, authContextFromRequest(request))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    throw error
  }
  if (!detail) return fail('REPORT.NOT_FOUND', 'Report not found', 404, { reportId, exportJobId })

  const body = serializeReportArtifact(detail, exportJobId, format)
  return new Response(body.content, {
    status: 200,
    headers: {
      'content-type': body.contentType,
      'content-disposition': `attachment; filename="${safeFileName(detail.reportId)}-${safeFileName(exportJobId)}.${body.extension}"`,
      'cache-control': 'no-store',
    },
  })
}

function isReportExportFormat(value: string | null): value is ReportExportRequestDto['format'] {
  return value === 'PDF' || value === 'EXCEL' || value === 'PPT'
}

function serializeReportArtifact(detail: ReportDetailDto, exportJobId: string, format: ReportExportRequestDto['format']) {
  if (format === 'EXCEL') {
    const rows = [
      ['reportId', 'title', 'version', 'status', 'totalSku', 'passedSku', 'repairableSku', 'blockedSku', 'exportJobId'],
      [
        detail.reportId,
        detail.title,
        detail.version,
        detail.status,
        String(detail.summary.totalSku),
        String(detail.summary.passedSku),
        String(detail.summary.repairableSku),
        String(detail.summary.blockedSku),
        exportJobId,
      ],
    ]
    return { content: rows.map((row) => row.map(csvCell).join(',')).join('\n'), contentType: 'text/csv; charset=utf-8', extension: 'csv' }
  }

  const payload = {
    exportJobId,
    format,
    reportId: detail.reportId,
    title: detail.title,
    version: detail.version,
    status: detail.status,
    generatedAt: detail.generatedAt,
    summary: detail.summary,
    evidenceSummary: detail.evidenceSummary,
  }
  return { content: JSON.stringify(payload, null, 2), contentType: 'application/json; charset=utf-8', extension: format === 'PPT' ? 'ppt.json' : 'pdf.json' }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}
