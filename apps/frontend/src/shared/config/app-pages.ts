import type { AppNavMenu } from '@/shared/types/app'

export const appMenus: AppNavMenu[] = [
  {
    key: 'overview',
    label: '概览',
    icon: 'Home',
    href: '/overview',
  },
  {
    key: 'sku-list',
    label: 'SKU 列表',
    icon: 'FileText',
    href: '/sku-access', // Prototype 3 / Image 2
  },
  {
    key: 'activity-management',
    label: '活动管理',
    icon: 'CalendarCheck',
    href: '/rule-execution', // Long-term activity rule execution page
  },
  {
    key: 'tasks-runs',
    label: '任务与运行',
    icon: 'ListTodo',
    children: [
      {
        key: 'agent-mission',
        label: 'Agent Mission',
        href: '/agent-mission', // Prototype 7 / Image 4
      }
    ]
  },
  {
    key: 'review-console',
    label: 'Review工作台',
    icon: 'ShieldCheck',
    href: '/review-approvals', // Image 5
  },
  {
    key: 'report-center',
    label: '报告中心',
    icon: 'BarChart3',
    href: '/report-center', // Image 6
  },
  {
    key: 'data-sources',
    label: '数据源',
    icon: 'Database',
    href: '/data-sources', // Image 7
  },
  {
    key: 'rule-library',
    label: '规则库',
    icon: 'BookOpen',
    href: '/rule-library', // Image 8
  },
  {
    key: 'settings',
    label: '设置',
    icon: 'Settings',
    children: [
      {
        key: 'run-console',
        label: '运行日志',
        href: '/run-console', // Prototype 5
      },
      {
        key: 'settings-home',
        label: '系统设置',
        href: '/settings',
      }
    ]
  }
]
