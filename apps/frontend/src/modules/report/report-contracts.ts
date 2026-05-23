export type ReportType = 'activity_readiness' | 'sku_health'

export type ReportOutputStatus = 'preview_ready' | 'export_placeholder' | 'export_requested'

export interface ReportEvidenceSummaryDto {
  id: string
  label: string
  value: string
  source: string
  href: string
}

export interface ReportSectionDto {
  id: string
  title: string
  summary: string
  bullets: string[]
  evidenceSummary: ReportEvidenceSummaryDto[]
}

export interface ReportPreviewDto {
  id: string
  title: string
  type: ReportType
  outputStatus: ReportOutputStatus
  generatedAt: string
  sourceObject: {
    id: string
    type: 'activity_simulation_run' | 'sku_health_summary'
    title: string
  }
  executiveSummary: string
  sections: ReportSectionDto[]
  evidenceSummary: ReportEvidenceSummaryDto[]
}
