export type StatusTone = "ready" | "repair" | "review" | "risky" | "blocked"

export interface KeyFact {
  readonly label: string
  readonly value: string
}

export interface PopupData {
  readonly platform: string
  readonly store: string
  readonly pageStatusLabel: string
  readonly pageStatusTone: StatusTone
  readonly pageStatusText: string
  readonly confidence: string
  readonly keyFacts: readonly KeyFact[]
  readonly securityTitle: string
  readonly securityText: string
  readonly primaryAction: string
  readonly secondaryAction: string
  readonly recentRunLabel: string
  readonly version: string
}

export interface HeroMetric {
  readonly label: string
  readonly value: string
  readonly note: string
}

export interface RecognitionFact {
  readonly label: string
  readonly value: string
}

export interface TimelineStep {
  readonly title: string
  readonly time: string
  readonly description: string
  readonly status: "done" | "active" | "waiting"
  readonly notes?: readonly string[]
}

export interface SummaryMetric {
  readonly label: string
  readonly value: string
  readonly tone: StatusTone
}

export interface CollectableField {
  readonly title: string
  readonly description: string
  readonly tag: string
}

export interface MappingRow {
  readonly sourceLabel: string
  readonly sourceArea: string
  readonly targetLabel: string
  readonly targetPurpose: string
}

export interface RiskItem {
  readonly title: string
  readonly description: string
  readonly tone: StatusTone
  readonly evidence: readonly string[]
}

export interface SidePanelData {
  readonly pageTitle: string
  readonly pageSubtitle: string
  readonly heroTitle: string
  readonly heroDetail: string
  readonly heroMetrics: readonly HeroMetric[]
  readonly recognitionTitle: string
  readonly recognitionDescription: string
  readonly recognitionFacts: readonly RecognitionFact[]
  readonly boundaryTitle: string
  readonly boundaryText: string
  readonly scanTitle: string
  readonly scanDescription: string
  readonly progressLabel: string
  readonly progressText: string
  readonly progressValue: number
  readonly runId: string
  readonly runSummary: readonly string[]
  readonly timeline: readonly TimelineStep[]
  readonly loopNote: string
  readonly nextPage: string
  readonly summaryMetrics: readonly SummaryMetric[]
  readonly collectableFields: readonly CollectableField[]
  readonly mappingRows: readonly MappingRow[]
  readonly risks: readonly RiskItem[]
  readonly primaryAction: string
  readonly secondaryAction: string
  readonly tertiaryAction: string
}
