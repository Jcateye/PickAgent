import type { PopupData, SidePanelData } from "../types/plugin-ui"

export const popupData: PopupData = {
  platform: "天猫商家后台",
  store: "北川家清旗舰店",
  pageStatusLabel: "可采集",
  pageStatusTone: "repair",
  pageStatusText: "当前页面已识别为 SKU 列表页",
  confidence: "置信度 96%",
  keyFacts: [
    { label: "API 连接", value: "控制台在线" },
    { label: "最近提交", value: "2 分钟前" },
    { label: "最近结果", value: "当前页采集中" },
    { label: "采集模式", value: "分页循环" }
  ],
  securityTitle: "仅采集当前授权页面可见字段",
  securityText: "不读取 Cookie、Token 或站外敏感凭证。采集前会展示字段清单与运行状态。",
  primaryAction: "打开采集侧边栏",
  secondaryAction: "打开总控制台",
  recentRunLabel: "最近 run：RUN-2026-06-18-1432",
  version: "v0.9.5"
}

export const sidePanelData: SidePanelData = {
  pageTitle: "SKU Ready Agent",
  pageSubtitle: "当前页面采集与准入预诊断",
  heroTitle: "商品列表页 · 第 3 页 / 共 18 页",
  heroDetail: "平台：天猫商家后台 / 店铺：北川家清旗舰店 / 本页识别到 24 个 SKU 节点",
  heroMetrics: [
    { label: "运行状态", value: "采集中", note: "已完成 82%" },
    { label: "当前 SKU", value: "G003", note: "炫白净渍 500ml" }
  ],
  recognitionTitle: "系统已识别为「SKU 列表 / 批量采集页」",
  recognitionDescription: "当前页面更适合批量自动化采集。插件将按页面列表逐个解析 SKU，再补充商品指标、评论摘要与统计数据，最后自动进入下一页继续运行。",
  recognitionFacts: [
    { label: "平台", value: "天猫商家后台" },
    { label: "当前页", value: "第 3 / 18 页" },
    { label: "页面 SKU 数", value: "24 个" },
    { label: "访问边界", value: "仅当前 DOM" }
  ],
  boundaryTitle: "安全边界",
  boundaryText: "不读取 Cookie / Token，不发起站外抓取。",
  scanTitle: "开始一次本页自动化采集",
  scanDescription: "系统将按列表逐个解析 SKU，并补充商品指标、重点评论与统计数据。不会自动修改后台数据。",
  progressLabel: "运行总进度",
  progressText: "本页 82% · 总任务 3 / 18 页",
  progressValue: 82,
  runId: "RUN-2026-06-18-1432",
  runSummary: ["已采 3 / 18 页", "本页 24 SKU", "异常 1"],
  timeline: [
    {
      title: "解析 SKU 列表",
      time: "14:32:08 完成",
      description: "已识别当前列表页 24 个 SKU 卡片，建立本页待处理队列。",
      status: "done",
      notes: ["命中 24 个列表节点", "页码识别成功"]
    },
    {
      title: "解析 SKU G003 · 炫白净渍 500ml",
      time: "进行中",
      description: "正在读取价格、库存、类目、活动标签与资质附件入口，并同步生成实体快照。",
      status: "active",
      notes: ["已取价格字段", "已取库存字段", "等待附件识别"]
    },
    {
      title: "采集商品指标",
      time: "等待执行",
      description: "将补充销量、库存阈值、活动命中字段和基础健康分输入。",
      status: "waiting"
    },
    {
      title: "重点评论采集",
      time: "等待执行",
      description: "采集重点差评标签与售后高频问题，用于风险补充与活动建议。",
      status: "waiting"
    },
    {
      title: "更新统计数据",
      time: "等待执行",
      description: "写入本次 run 计数、页面统计、问题分布与待 Review 数。",
      status: "waiting"
    }
  ],
  loopNote: "完成本页后将自动执行：继续下一页 → 重新解析 SKU 列表 → 循环采集",
  nextPage: "下一页：第 4 / 18 页",
  summaryMetrics: [
    { label: "已完成 SKU", value: "14", tone: "ready" },
    { label: "可修复问题", value: "6", tone: "repair" },
    { label: "人工确认", value: "1", tone: "review" },
    { label: "阻断项", value: "0", tone: "blocked" }
  ],
  collectableFields: [
    { title: "SKU 编码 / 商品标题", description: "用于建立主实体与控制台内 SKU 对齐。", tag: "必需" },
    { title: "活动价 / 日常价 / 券后价口径", description: "用于价格合规校验与报名规则检查。", tag: "关键" },
    { title: "库存 / 锁定库存 / 近 7 天销量", description: "用于补货模拟与缺货风险预警。", tag: "关键" },
    { title: "类目 / 商品属性", description: "用于规则命中与类目证书校验。", tag: "规则" },
    { title: "资质附件 / 有效期", description: "用于证书缺失或即将过期的风险识别。", tag: "风险" },
    { title: "主图 / 卖点图", description: "用于素材完整度与活动素材建议。", tag: "可选" }
  ],
  mappingRows: [
    { sourceLabel: "页面字段：促销价", sourceArea: "页面区块：价格配置卡片", targetLabel: "标准字段：activityPrice", targetPurpose: "规则用途：活动价口径校验" },
    { sourceLabel: "页面字段：可售库存", sourceArea: "页面区块：库存与履约", targetLabel: "标准字段：availableStock", targetPurpose: "规则用途：库存阈值与补货模拟" },
    { sourceLabel: "页面字段：质检报告有效期", sourceArea: "页面区块：资质附件", targetLabel: "标准字段：certificateExpiry", targetPurpose: "规则用途：证书有效性校验" }
  ],
  risks: [
    {
      title: "活动价与近 30 天最低价口径存在偏差",
      description: "当前活动价 59 元，历史最低成交口径推算为 56 元，存在价格口径不一致风险。建议进入控制台进一步校验促销规则。",
      tone: "risky",
      evidence: ["证据：价格配置区块", "规则：PR-218", "来源：本页扫描"]
    },
    {
      title: "库存低于活动建议阈值，可修复",
      description: "可售库存 43，低于该类目建议阈值 80。若本次活动流量放大，可能触发报名后缺货风险。",
      tone: "repair",
      evidence: ["证据：库存字段", "建议：补货 +40", "来源：规则估算"]
    },
    {
      title: "质检报告附件需人工确认版本",
      description: "页面存在报告附件，但文件名未能确认是否为最新模板。系统建议转交人工 Review，不自动判定合规。",
      tone: "review",
      evidence: ["证据：资质附件区块", "Gate：需人工确认", "来源：附件文件名匹配"]
    }
  ],
  primaryAction: "暂停 / 重新扫描",
  secondaryAction: "发送到 Agent 分析",
  tertiaryAction: "打开控制台查看完整证据链"
}
