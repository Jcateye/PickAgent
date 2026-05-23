import type { ReviewItemDto } from './review-contracts'

export const mockReviewItems: ReviewItemDto[] = [
  {
    id: 'REV-1001',
    targetLabel: 'SKU-AU-18K-042',
    status: 'pending',
    source: {
      id: 'SIM-2026-05-MIDYEAR-01',
      type: 'activity_simulation',
      title: '618 活动准入模拟',
      routeLabel: '查看模拟结果',
      href: '/activities'
    },
    question: '是否允许该 SKU 在补齐库存承诺后进入活动报名清单？',
    recommendation: '建议要求供应链确认 7 日内补货计划后批准。',
    riskLevel: 'high',
    riskSummary: '当前可售库存低于活动门槛，且近 30 日动销高于安全库存消耗速度。',
    evidenceSummary: [
      { id: 'EV-1', label: '活动库存门槛', value: '>= 120 件', source: 'ActivityRuleSet', href: '/activities' },
      { id: 'EV-2', label: '当前可售库存', value: '86 件', source: 'CurrentSkuProjection', href: '/sku-health' },
      { id: 'EV-3', label: '近 30 日销量', value: '143 件', source: 'ActivitySimulationResult', href: '/activities' }
    ],
    createdAt: '2026-05-22 10:30',
    updatedAt: '2026-05-22 11:05'
  },
  {
    id: 'REV-1002',
    targetLabel: 'SKU-DIA-PT950-017',
    status: 'pending',
    source: {
      id: 'HEALTH-2026-05-22-07',
      type: 'health_diagnosis',
      title: 'SKU 健康诊断',
      routeLabel: '查看健康档案',
      href: '/sku-health'
    },
    question: '证书编号缺失时是否允许商品进入修复队列而不是直接阻断？',
    recommendation: '建议驳回报名，先由商品团队补齐 GIA 证书编号。',
    riskLevel: 'medium',
    riskSummary: '珠宝类目证书字段缺失会影响平台素材审核，通过人工豁免风险较高。',
    evidenceSummary: [
      { id: 'EV-4', label: '证书编号', value: '缺失', source: 'SkuSnapshot', href: '/sku-health' },
      { id: 'EV-5', label: '类目规则', value: '钻石戒指必须提供证书编号', source: 'SkuHealthDiagnosis', href: '/sku-health' }
    ],
    createdAt: '2026-05-22 14:12',
    updatedAt: '2026-05-22 14:30'
  },
  {
    id: 'REV-1003',
    targetLabel: 'Agent Gate: MIDYEAR-CAMPAIGN',
    status: 'approved',
    source: {
      id: 'GATE-AGENT-008',
      type: 'agent_gate',
      title: 'Agent Review Gate',
      routeLabel: '查看 Review Gate',
      href: '/agent-chat'
    },
    question: '是否采用 Agent 给出的活动优先报名 SKU 批次？',
    recommendation: '建议批准低风险批次，并保留高风险 SKU 的人工复核。',
    riskLevel: 'low',
    riskSummary: '批次仅包含 Direct Ready SKU，且全部证据来自服务端 simulation DTO。',
    evidenceSummary: [
      { id: 'EV-6', label: 'Direct Ready SKU', value: '42 个', source: 'ActivitySimulationRun', href: '/activities' },
      { id: 'EV-7', label: '高风险 SKU', value: '0 个', source: 'AgentReviewGate', href: '/agent-chat' }
    ],
    createdAt: '2026-05-21 16:20',
    updatedAt: '2026-05-21 16:55',
    decisionComment: '批准低风险批次进入报告输出。',
    decidedAt: '2026-05-21 16:55'
  }
]
