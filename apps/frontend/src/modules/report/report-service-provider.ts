import { createBusinessFoundationRuntime } from '../../../../backend/src/application/foundation/BusinessFoundationServices'
import type { ReportPreviewDto as ServiceReportPreviewDto } from '../../../../contracts/types/businessFoundation'

import type { ReportPreviewDto, ReportType } from './report-contracts'
import { mockReportPreview } from './report-fixtures'

export interface ReportProviderSnapshot {
  preview: ReportPreviewDto
  mode: 'service' | 'mock_fallback'
  fallbackReason?: string
}

export function createReportProviderSnapshot(): ReportProviderSnapshot {
  try {
    const runtime = createBusinessFoundationRuntime()
    const ingest = runtime.ingestService.ingest({
      collectedAt: new Date('2026-05-23T10:00:00.000Z').toISOString(),
      rows: [
        {
          platform: 'douyin',
          storeId: 'demo-store',
          externalSkuId: 'SKU-AU-18K-042',
          productName: '18K 金项链 / 经典链长',
          stock: 8,
          positiveRate: 0.96,
          certificateStatus: 'valid',
          raw: { fixture: 'layer3-review-reporting', source: 'ReportService seed' }
        },
        {
          platform: 'douyin',
          storeId: 'demo-store',
          externalSkuId: 'SKU-DIA-PT950-017',
          productName: 'PT950 钻戒 / 主石 30 分',
          stock: 32,
          positiveRate: 0.9,
          certificateStatus: 'missing',
          raw: { fixture: 'layer3-review-reporting', source: 'ReportService seed' }
        }
      ]
    })
    const ruleSet = runtime.activityRuleService.parseRules({
      name: '618 活动准入规则',
      platform: 'douyin',
      sourceText: '库存不少于 20，好评率不少于 92%，证书必须有效，manual check'
    })
    const simulations = runtime.activitySimulationService.runSimulation({
      ruleSetId: ruleSet.ruleSetId,
      skuProfileIds: ingest.summaries.map((item) => item.skuProfileId)
    })
    const preview = runtime.reportService.generatePreview({
      type: 'ACTIVITY',
      skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
      simulationResultIds: simulations.map((item) => item.simulationResultId)
    })

    return { preview: mapServiceReportPreview(preview), mode: 'service' }
  } catch (error) {
    return {
      preview: mockReportPreview,
      mode: 'mock_fallback',
      fallbackReason: error instanceof Error ? error.message : 'ReportService provider failed'
    }
  }
}

function mapServiceReportPreview(preview: ServiceReportPreviewDto): ReportPreviewDto {
  return {
    id: preview.reportId,
    title: preview.title,
    type: mapReportType(preview.type),
    outputStatus: 'preview_ready',
    generatedAt: '2026-05-23 10:00',
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
      evidenceSummary: section.evidence.map((evidence) => ({
        id: `${evidence.type}:${evidence.entityId}`,
        label: evidence.label,
        value: evidence.summary,
        source: evidence.type
      }))
    })),
    evidenceSummary: preview.evidenceSummary.map((evidence) => ({
      id: `${evidence.type}:${evidence.entityId}`,
      label: evidence.label,
      value: evidence.summary,
      source: evidence.type
    }))
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
