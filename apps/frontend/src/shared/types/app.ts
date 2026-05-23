export type AppPageKey =
  | 'dashboard'
  | 'connectors'
  | 'sku-health'
  | 'activities'
  | 'reviews'
  | 'reports'
  | 'agent-chat'
  | 'workflows'

export interface AppPageDefinition {
  key: AppPageKey
  href: `/${string}`
  title: string
  description: string
  navLabel: string
  icon: string
  category: 'primary' | 'secondary'
}
