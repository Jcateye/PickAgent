import type {
  ConnectorConsoleDto,
  DashboardSummaryDto,
  SkuDetailDto,
} from '@/modules/staff-health-console/contracts'

export const mockDashboardSummary: DashboardSummaryDto = {
  metrics: [
    { id: 'scope', label: '监控 SKU', value: '128', description: '覆盖 3 个平台、5 个店铺', tone: 'neutral' },
    { id: 'ready', label: 'Ready', value: '72', description: '可直接进入活动报名准备', tone: 'ready' },
    { id: 'repairable', label: 'Repairable', value: '31', description: '存在可修复资料或库存问题', tone: 'review' },
    { id: 'risky', label: 'Risky', value: '18', description: '需要运营或商品负责人复核', tone: 'warning' },
    { id: 'blocked', label: 'Blocked', value: '7', description: '证据不足或硬性阻断', tone: 'blocked' },
    { id: 'quality', label: '数据质量', value: '86%', description: '来自服务端 summary DTO', tone: 'ready' },
  ],
  riskSummaries: [
    {
      id: 'missing-certificate',
      label: '证书字段缺失',
      count: 12,
      description: '影响珠宝类目活动准入和详情页合规检查',
      targetHref: '/sku-health',
      tone: 'review',
    },
    {
      id: 'stock-risk',
      label: '库存低于阈值',
      count: 9,
      description: '最近一次采集显示可售库存不足',
      targetHref: '/sku-health',
      tone: 'warning',
    },
    {
      id: 'price-blocked',
      label: '价格证据阻断',
      count: 7,
      description: '近 30 天价格证据缺失或不一致',
      targetHref: '/sku-health',
      tone: 'blocked',
    },
  ],
  recentRuns: [
    {
      id: 'run_20260523_001',
      title: '天猫旗舰店 SKU 采集',
      source: 'Chrome Extension',
      status: 'SUCCEEDED',
      finishedAtLabel: '今天 09:42',
      targetHref: '/workflows',
      summary: '写入 42 条 projection，发现 6 条资料字段缺失。',
    },
    {
      id: 'run_20260523_002',
      title: '京东自营店健康刷新',
      source: 'Mock Workflow',
      status: 'WAITING_FOR_REVIEW',
      finishedAtLabel: '今天 10:18',
      targetHref: '/workflows',
      summary: '3 条 SKU 需要人工确认价格证据来源。',
    },
  ],
  primaryLinks: [
    { label: '查看连接器', href: '/connectors', description: '确认采集来源、最近运行和边界说明' },
    { label: '查看 SKU 列表', href: '/sku-health', description: '按服务端 projection 浏览当前健康状态' },
    { label: '查看运行摘要', href: '/workflows', description: '进入 workflow run 视图查看长任务状态' },
  ],
}

export const mockConnectorConsole: ConnectorConsoleDto = {
  connectors: [
    {
      id: 'connector_chrome_extension',
      name: 'Chrome 采集插件',
      platform: 'Browser Extension',
      status: 'CONNECTED',
      lastIngestedAtLabel: '今天 09:42',
      lastIngestSummary: '采集 42 条商品行，生成 42 条 CurrentSkuProjection 草案。',
      capabilityBoundary: '只提交采集 payload，不执行健康判断、改价或活动报名。',
      targetHref: '/workflows',
    },
    {
      id: 'connector_tmall_mock',
      name: '天猫店铺 Mock 源',
      platform: 'Tmall',
      status: 'DEGRADED',
      lastIngestedAtLabel: '昨天 18:10',
      lastIngestSummary: '库存字段完整，证书字段缺失率 18%。',
      capabilityBoundary: 'Layer 1 仅展示连接状态和最近采集摘要。',
      targetHref: '/sku-health',
    },
    {
      id: 'connector_erp_placeholder',
      name: 'ERP 库存源',
      platform: 'ERP',
      status: 'SETUP_REQUIRED',
      lastIngestedAtLabel: '未接入',
      lastIngestSummary: '等待 backend-business-foundation 提供真实 query 能力。',
      capabilityBoundary: '不在本 change 中实现真实 ERP 接入。',
      targetHref: '/connectors',
    },
  ],
  collectionBoundaries: [
    {
      id: 'no-plugin-control',
      label: '不控制插件自动化',
      description: '员工工作台只展示连接状态和采集摘要，不承担插件运行流程控制。',
    },
    {
      id: 'no-health-recalc',
      label: '不重算健康结论',
      description: '页面只消费 summary、projection 和 detail DTO，不拼 snapshot 与 diagnosis。',
    },
    {
      id: 'mock-first',
      label: 'Mock DTO 闭环',
      description: '真实接口完成前保持同一 contract，由 adapter 切换数据来源。',
    },
  ],
}

export const mockSkuDetails: SkuDetailDto[] = [
  {
    projection: {
      skuProfileId: 'sku_gold_ring_001',
      canonicalSkuKey: 'tmall:flagship:GR-001',
      productName: '18K 金钻石戒指 经典款',
      platform: 'Tmall',
      storeName: '旗舰店',
      healthStatus: 'READY',
      healthScore: 94,
      dataQualityScore: 96,
      issueSummary: '关键资料完整，库存和价格证据可用于活动准备。',
      nextAction: '保持日常监控，活动规则发布后进入准入模拟。',
      updatedAtLabel: '今天 09:42',
      targetHref: '/sku-health/sku_gold_ring_001',
    },
    issues: [],
    evidence: [
      { id: 'stock', label: '可售库存', value: '126', source: '最近采集 projection' },
      { id: 'certificate', label: '证书编号', value: '已采集', source: '商品详情字段' },
      { id: 'price', label: '近 30 天价格证据', value: '完整', source: '价格快照摘要' },
    ],
    nextActions: [
      {
        id: 'monitor',
        title: '保持监控',
        description: '无需人工修复，等待活动规则进入模拟模块。',
        owner: '运营',
      },
    ],
  },
  {
    projection: {
      skuProfileId: 'sku_necklace_002',
      canonicalSkuKey: 'tmall:flagship:NL-002',
      productName: '珍珠项链 礼盒装',
      platform: 'Tmall',
      storeName: '旗舰店',
      healthStatus: 'REPAIRABLE',
      healthScore: 78,
      dataQualityScore: 82,
      issueSummary: '材质说明完整，但证书图缺失，需要商品团队补齐。',
      nextAction: '补充证书图和材质来源后重新刷新 projection。',
      updatedAtLabel: '今天 09:42',
      targetHref: '/sku-health/sku_necklace_002',
    },
    issues: [
      {
        id: 'missing-certificate-image',
        severity: 'review',
        title: '证书图缺失',
        summary: '当前 projection 标记证书编号存在，但缺少证书图片证据。',
      },
    ],
    evidence: [
      { id: 'certificate-no', label: '证书编号', value: 'GIA-MOCK-2026', source: '商品详情字段' },
      { id: 'certificate-image', label: '证书图片', value: '缺失', source: '数据质量摘要' },
      { id: 'stock', label: '可售库存', value: '64', source: '最近采集 projection' },
    ],
    nextActions: [
      {
        id: 'upload-certificate-image',
        title: '补齐证书图片',
        description: '由商品团队补充证据后触发下一次采集刷新。',
        owner: '商品团队',
      },
      {
        id: 'refresh-projection',
        title: '刷新当前读模型',
        description: '补齐资料后由后端 query 能力重新生成 CurrentSkuProjection。',
        owner: '系统',
      },
    ],
  },
  {
    projection: {
      skuProfileId: 'sku_bracelet_003',
      canonicalSkuKey: 'jd:self:BR-003',
      productName: '黄金手链 足金简约款',
      platform: 'JD',
      storeName: '京东自营店',
      healthStatus: 'RISKY',
      healthScore: 63,
      dataQualityScore: 74,
      issueSummary: '库存偏低且价格证据需要复核，不建议直接进入报名。',
      nextAction: '运营复核库存补货窗口，并确认近 30 天最低价证据。',
      updatedAtLabel: '今天 10:18',
      targetHref: '/sku-health/sku_bracelet_003',
    },
    issues: [
      {
        id: 'low-stock',
        severity: 'warning',
        title: '库存偏低',
        summary: '可售库存低于当前活动准备建议阈值。',
      },
      {
        id: 'price-evidence',
        severity: 'review',
        title: '价格证据需复核',
        summary: '最近价格快照来源不完整，需人工确认。',
      },
    ],
    evidence: [
      { id: 'stock', label: '可售库存', value: '18', source: 'ERP mock 摘要' },
      { id: 'price', label: '近 30 天最低价', value: '待复核', source: '价格快照摘要' },
      { id: 'updated', label: '最近刷新', value: '今天 10:18', source: 'Workflow run' },
    ],
    nextActions: [
      {
        id: 'review-stock',
        title: '确认补货窗口',
        description: '供应链确认补货是否能赶上活动周期。',
        owner: '供应链',
      },
      {
        id: 'review-price',
        title: '复核价格证据',
        description: '运营确认价格证据来源后再进入活动模拟。',
        owner: '运营',
      },
    ],
  },
  {
    projection: {
      skuProfileId: 'sku_pendant_004',
      canonicalSkuKey: 'tmall:flagship:PD-004',
      productName: '翡翠吊坠 高端款',
      platform: 'Tmall',
      storeName: '旗舰店',
      healthStatus: 'BLOCKED',
      healthScore: 41,
      dataQualityScore: 58,
      issueSummary: '关键证书字段与价格证据同时缺失，当前阻断。',
      nextAction: '先补齐证书、材质和价格证据，再由服务端重新评估。',
      updatedAtLabel: '昨天 18:10',
      targetHref: '/sku-health/sku_pendant_004',
    },
    issues: [
      {
        id: 'missing-core-evidence',
        severity: 'blocked',
        title: '关键证据缺失',
        summary: '证书、材质来源和价格证据缺失，无法支持活动准入判断。',
      },
    ],
    evidence: [
      { id: 'certificate', label: '证书编号', value: '缺失', source: '数据质量摘要' },
      { id: 'material', label: '材质来源', value: '缺失', source: '商品详情字段' },
      { id: 'price', label: '价格证据', value: '缺失', source: '价格快照摘要' },
    ],
    nextActions: [
      {
        id: 'repair-core-fields',
        title: '补齐核心资料',
        description: '商品团队补齐资料前不进入活动模拟或 Review 审批。',
        owner: '商品团队',
      },
    ],
  },
]
