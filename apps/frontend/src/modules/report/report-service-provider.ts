import type { ApiEnvelope, ReportRequestDto } from '../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import type { EvidenceLinkDto, ReportPreviewDto as ServiceReportPreviewDto } from '../../../../contracts/types/businessFoundation'

import type { ReportPreviewDto, ReportType } from './report-contracts'

export async function fetchReportPreview(): Promise<ReportPreviewDto> {
  const seed = await fetch('/api/reports/snapshot', { cache: 'no-store' })
  const seedEnvelope = (await seed.json()) as ApiEnvelope<ReportRequestDto>
  if (!seed.ok || seedEnvelope.code !== 'OK' || !seedEnvelope.data) {
    throw new Error(seedEnvelope.message || 'Report snapshot API failed')
  }

  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(seedEnvelope.data)
  })
  const envelope = (await response.json()) as ApiEnvelope<ServiceReportPreviewDto>
  if (!response.ok || envelope.code !== 'OK' || !envelope.data) {
    throw new Error(envelope.message || 'Report API failed')
  }
  return mapServiceReportPreview(envelope.data)
}

function mapServiceReportPreview(preview: ServiceReportPreviewDto): ReportPreviewDto {
  return {
    id: preview.reportId,
    title: preview.title,
    type: mapReportType(preview.type),
    outputStatus: 'preview_ready',
    generatedAt: '持久化 Report API',
    sourceObject: {
      id: preview.reportId,
      type: preview.type === 'ACTIVITY' ? 'activity_simulation_run' : 'sku_health_summary',
      title: preview.type === 'ACTIVITY' ? '活动准入模拟 Run' : 'SKU 健康摘要'
    },
    executiveSummary: preview.sections[0]?.summary ?? 'ReportService 已返回报告预览。',
    sections: preview.sections.map((section) => ({
      id: section.id,
      title: section.title,
      summary: section.summary,
      bullets: splitSummary(section.summary),
      evidenceSummary: section.evidence.map(mapEvidence)
    })),
    evidenceSummary: preview.evidenceSummary.map(mapEvidence)
  }
}

function mapEvidence(evidence: EvidenceLinkDto) {
  return {
    id: `${evidence.type}:${evidence.entityId}`,
    label: evidence.label,
    value: evidence.summary,
    source: evidence.type,
    href: evidenceHref(evidence.type, evidence.entityId)
  }
}

function mapReportType(type: ServiceReportPreviewDto['type']): ReportType {
  return type === 'HEALTH' ? 'sku_health' : 'activity_readiness'
}

function splitSummary(summary: string): string[] {
  return summary
    .split('；')
    .map((item) => item.trim())
    .filter(Boolean)
}

function evidenceHref(type: EvidenceLinkDto['type'], entityId: string) {
  const encodedId = encodeURIComponent(entityId)
  if (type === 'snapshot' || type === 'diagnosis') return `/sku-health?evidence=${encodedId}`
  if (type === 'rule' || type === 'simulation') return `/activities?evidence=${encodedId}`
  if (type === 'review') return `/reviews?evidence=${encodedId}`
  if (type === 'tool_trace') return `/agent-chat?evidence=${encodedId}`
  return `/workflows?evidence=${encodedId}`
}
