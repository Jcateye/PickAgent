import type { ReportPreviewDto } from './report-contracts'

export const mockReportPreview: ReportPreviewDto = {
  id: 'RPT-MIDYEAR-READY-001',
  title: '618 活动 SKU Ready 报告',
  type: 'activity_readiness',
  outputStatus: 'preview_ready',
  generatedAt: '2026-05-22 18:10',
  sourceObject: {
    id: 'SIM-RUN-2026-05-22-01',
    type: 'activity_simulation_run',
    title: '618 活动准入模拟 Run'
  },
  executiveSummary:
    '本报告消费服务端返回的活动模拟与 Review DTO，展示可直接报名、需修复和需人工确认的 SKU 结构，不在前端重新生成活动结论。',
  sections: [
    {
      id: 'SECTION-READY',
      title: '准入概览',
      summary: 'Direct Ready SKU 占比稳定，主要阻断项集中在库存和证书字段。',
      bullets: ['Direct Ready：42 个', 'Repairable Ready：11 个', 'Manual Review：6 个', 'Blocked：4 个'],
      evidenceSummary: [
        { id: 'REV-EV-1', label: '模拟 Run', value: 'SIM-RUN-2026-05-22-01', source: 'ActivitySimulationRun', href: '/activities' },
        { id: 'REV-EV-2', label: '规则集', value: 'MIDYEAR-RULESET-V3', source: 'ActivityRuleSet', href: '/activities' }
      ]
    },
    {
      id: 'SECTION-RISK',
      title: '风险与人工确认',
      summary: '人工 Review 主要处理证据缺失、库存承诺和 Agent Gate 审批。',
      bullets: ['高风险 Review：1 个', '证据缺失 Review：2 个', '已批准 Review：1 个'],
      evidenceSummary: [
        { id: 'REV-EV-3', label: 'Review Queue', value: 'REV-1001 / REV-1002 / REV-1003', source: 'ReviewItem', href: '/reviews' }
      ]
    },
    {
      id: 'SECTION-NEXT',
      title: '下一步动作',
      summary: '建议先处理库存承诺与证书字段，再输出正式报名清单。',
      bullets: ['供应链确认 7 日补货计划', '商品团队补齐证书编号', '运营导出低风险 SKU 批次'],
      evidenceSummary: [
        { id: 'REV-EV-4', label: '待处理来源', value: 'Review / Report DTO', source: 'ReportService DTO', href: '/reports' }
      ]
    }
  ],
  evidenceSummary: [
    { id: 'REV-EV-1', label: '模拟 Run', value: 'SIM-RUN-2026-05-22-01', source: 'ActivitySimulationRun', href: '/activities' },
    { id: 'REV-EV-2', label: '规则集', value: 'MIDYEAR-RULESET-V3', source: 'ActivityRuleSet', href: '/activities' },
    { id: 'REV-EV-3', label: 'Review Queue', value: 'REV-1001 / REV-1002 / REV-1003', source: 'ReviewItem', href: '/reviews' },
    { id: 'REV-EV-4', label: '待处理来源', value: 'Review / Report DTO', source: 'ReportService DTO', href: '/reports' }
  ]
}
