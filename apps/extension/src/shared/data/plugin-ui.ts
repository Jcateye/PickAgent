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
  pageSubtitle: "当前页面采集与字段预览",
  heroTitle: "商品列表页 · 第 3 页 / 共 18 页",
  heroDetail: "平台：天猫商家后台 / 店铺：北川家清旗舰店 / 本页识别到 24 个 SKU 节点",
  heroMetrics: [
    { label: "运行状态", value: "采集中", note: "已完成 82%" },
    { label: "当前 SKU", value: "G003", note: "炫白净渍 500ml" }
  ],
  recognitionTitle: "系统已识别为「SKU 列表 / 批量采集页」",
  recognitionDescription: "当前页面更适合批量自动化采集。插件将按页面列表逐个解析 SKU，生成字段映射预览，最后自动进入下一页继续运行。",
  recognitionFacts: [
    { label: "平台", value: "天猫商家后台" },
    { label: "当前页", value: "第 3 / 18 页" },
    { label: "页面 SKU 数", value: "24 个" },
    { label: "访问边界", value: "仅当前 DOM" }
  ],
  boundaryTitle: "安全边界",
  boundaryText: "不读取 Cookie / Token，不发起站外抓取。",
  scanTitle: "开始一次本页自动化采集",
  scanDescription: "系统将按列表逐个解析 SKU，并生成采集 payload。不会自动修改后台数据。",
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
      description: "正在读取价格、库存、类目和页面状态，并同步生成本次采集快照。",
      status: "active",
      notes: ["已取价格字段", "已取库存字段", "等待附件识别"]
    },
    {
      title: "采集页面字段",
      time: "等待执行",
      description: "将补充页面可见字段、字段来源和缺失项提示。",
      status: "waiting"
    },
    {
      title: "字段异常记录",
      time: "等待执行",
      description: "记录空值、无法映射字段与页面结构异常，不推导业务结论。",
      status: "waiting"
    },
    {
      title: "更新统计数据",
      time: "等待执行",
      description: "写入本次 run 计数、页面统计、字段异常和 mock submit 状态。",
      status: "waiting"
    }
  ],
  loopNote: "完成本页后将自动执行：继续下一页 → 重新解析 SKU 列表 → 循环采集",
  nextPage: "下一页：第 4 / 18 页",
  summaryMetrics: [
    { label: "已采记录", value: "14", tone: "ready" },
    { label: "映射字段", value: "6", tone: "repair" },
    { label: "异常字段", value: "1", tone: "review" },
    { label: "结构失败", value: "0", tone: "blocked" }
  ],
  collectableFields: [
    { title: "SKU 编码 / 商品标题", description: "用于建立主实体与控制台内 SKU 对齐。", tag: "必需" },
    { title: "价格字段", description: "用于提交采集事实，后续服务端再解释字段含义。", tag: "关键" },
    { title: "库存字段", description: "用于提交当前页可见库存事实。", tag: "关键" },
    { title: "类目 / 商品属性", description: "用于保留页面可见分类信息。", tag: "字段" },
    { title: "附件入口 / 有效期文本", description: "仅记录页面可见文本，不做合规判断。", tag: "可选" },
    { title: "主图 / 卖点图", description: "仅记录页面可见素材入口。", tag: "可选" }
  ],
  mappingRows: [
    { sourceLabel: "页面字段：促销价", sourceArea: "页面区块：价格配置卡片", targetLabel: "标准字段：salePrice", targetPurpose: "采集用途：保留页面价格事实" },
    { sourceLabel: "页面字段：可售库存", sourceArea: "页面区块：库存与履约", targetLabel: "标准字段：availableStock", targetPurpose: "采集用途：保留页面库存事实" },
    { sourceLabel: "页面字段：质检报告有效期", sourceArea: "页面区块：资质附件", targetLabel: "标准字段：certificateExpiry", targetPurpose: "采集用途：保留页面文本事实" }
  ],
  risks: [
    {
      title: "价格字段样例为空",
      description: "当前页存在价格字段为空的记录，payload 会保留为空值并提示提交前确认。",
      tone: "risky",
      evidence: ["证据：价格配置区块", "来源：本页扫描"]
    },
    {
      title: "库存字段已映射",
      description: "页面可见库存字段已映射为 availableStock，后续判断由服务端能力承接。",
      tone: "repair",
      evidence: ["证据：库存字段", "来源：本页扫描"]
    },
    {
      title: "附件入口仅作文本事实记录",
      description: "页面存在附件入口，但插件只记录可见文本和来源，不自动判定文件版本。",
      tone: "review",
      evidence: ["证据：资质附件区块", "来源：附件文件名匹配"]
    }
  ],
  primaryAction: "暂停 / 重新扫描",
  secondaryAction: "mock submit payload",
  tertiaryAction: "打开控制台查看采集结果"
}
