export type AppPageKey =
  | 'overview'
  | 'sku-list'
  | 'activity-management'
  | 'tasks-runs'
  | 'report-center'
  | 'data-sources'
  | 'rule-library'
  | 'settings'
  | 'rule-execution'
  | 'sku-access'
  | 'review-approvals'
  | 'run-console'
  | 'agent-mission'
  | 'extension-preview'

export interface AppNavMenu {
  key: string
  label: string
  icon: string
  href?: string
  children?: {
    key: string
    label: string
    href: string
  }[]
}
