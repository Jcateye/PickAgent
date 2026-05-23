下面是一份可以直接拿去做开发对齐、路演准备、产品说明的 **完整 PRD v0.1**。我会按“明天黑客松可落地”的粒度写，同时保留产品化扩展空间。

---

# PRD：SKU Ready Agent

## 多平台商品健康监控与活动准入智能体

版本：v0.1  
方向：C 执行辅助 Agent  
定位：企业 Agent 体系中的运营执行层  
技术栈：TypeScript / Next.js / assistant-ui / Vercel AI SDK / Plasmo / PostgreSQL / Prisma / Zod / Typed Workflow  
核心口号：

> **不是活动来了才筛 SKU，而是让每个 SKU 平时就处于 Ready 状态。**

---

# 1. 产品概述

## 1.1 产品名称

**SKU Ready Agent**

副标题：

> 多平台商品健康监控与活动准入智能体

也可以在路演中使用更业务化的中文名：

> **商品健康体检与活动准入 Agent**

---

## 1.2 一句话介绍

SKU Ready Agent 通过数据源连接器接入电商后台、平台 API、ERP 和报表数据，在服务端统一建立 SKU 健康档案，持续监控商品库存、销量、评价、价格、活动状态、证书信息和经营表现。当活动规则发布时，Agent 自动解析规则，结合商品健康数据判断哪些 SKU 可直接报名、哪些可修复后报名、哪些不建议报名，并生成修复建议、预警、报告和人工 Review 清单。

---

## 1.3 产品定位

SKU Ready Agent 不是一个单次活动筛选工具，也不是一个普通聊天机器人，而是：

> **企业 Agent 体系里的运营执行层。**

它负责把来自战略、合规、平台活动和内部 SOP 的规则与目标，落到具体 SKU、商品健康、运营任务和人工 Review 上。

在多 Agent 体系中：

```text
A 战略模拟 Agent：看机会
D 风控合规 Agent：看边界
C SKU Ready Agent：做落地
```

---

# 2. 背景与问题

## 2.1 企业真实场景

企业 X 是大型珠宝集团，业务涉及多个电商平台、多个区域、多个门店、多类珠宝商品。日常运营中，活动报名、商品维护和平台规则执行高度依赖人工判断。

典型场景包括：

```text
1. 天猫 / 京东 / 淘宝 / 海外平台发布活动规则。
2. 运营临时去后台拉商品数据。
3. 再去 ERP 查库存、成本、毛利。
4. 再用 Excel 对规则进行过滤。
5. 再人工判断 SKU 是否可报名。
6. 再找商品、供应链、法务或运营负责人确认。
```

这个流程的问题是：**活动来了以后才发现问题，很多商品已经来不及修。**

例如：

```text
库存不足
好评率下降
商品证书缺失
活动价高于近30天最低价
已参加互斥活动
高毛利 SKU 不够
商品详情页信息不完整
钻石 4C / 黄金克重 / 证书编号缺失
```

---

## 2.2 核心痛点

|痛点|说明|
|---|---|
|数据分散|商品数据在电商后台、ERP、活动系统、售后系统、报表中分散存在|
|准备滞后|活动开始前才拉数据，发现问题时已来不及修复|
|规则复杂|平台活动规则涉及销量、库存、价格、类目、互斥、时间节点等|
|人工筛选低效|Excel 可以筛，但前提是数据已经准备好，且规则能人工准确理解|
|缺少长期监控|商品是否处于 Ready 状态没有持续追踪|
|缺少执行闭环|风险发现后，很难自动生成修复任务和 Review 清单|
|AI 不确定性风险|如果让大模型直接判断，容易出现幻觉、误判和不可追溯问题|

---

## 2.3 产品机会

传统方案是：

```text
活动来了 → 临时拉数据 → Excel 筛选 → 人工判断
```

SKU Ready Agent 的方案是：

```text
平时自动采集数据 → 持续维护 SKU 健康档案 → 提前预警和修复 → 活动来了自动模拟准入 → 人工 Review 后执行
```

核心价值：

> **把临时救火变成日常预警，把人工筛选变成持续执行辅助。**

---

# 3. 产品目标

## 3.1 业务目标

1. 降低活动报名前的数据准备成本。
    
2. 提前发现商品健康问题，减少临时报名失败。
    
3. 提高 SKU 活动准入判断的准确性和可追溯性。
    
4. 帮助运营、商品、供应链、法务之间形成 Review 协同。
    
5. 为战略 Agent 和合规 Agent 提供可执行性反馈。
    
6. 建立企业统一的 SKU Ready 状态体系。
    

---

## 3.2 用户目标

运营人员希望：

```text
不用每次活动都临时拉 Excel。
快速知道哪些 SKU 能报名。
知道不能报名的原因。
知道哪些问题可以修。
知道该找谁确认。
```

商品团队希望：

```text
知道哪些商品资料不完整。
知道哪些珠宝商品缺证书、材质、克重、钻石 4C 等信息。
```

供应链团队希望：

```text
提前知道哪些 SKU 需要补货。
知道补货后是否能转为活动 Ready。
```

法务 / 风控团队希望：

```text
规则变化能落到具体商品检查项上。
高风险动作不会被 AI 自动执行。
每个判断都有证据链和 Review 记录。
```

管理层希望：

```text
知道整体商品 Ready 率。
知道活动准备状态。
知道哪些平台、品类、区域存在执行风险。
```

---

# 4. 非目标

MVP 阶段不做以下功能：

```text
1. 不真实接入天猫 / 京东生产后台。
2. 不自动改价。
3. 不自动提交活动报名。
4. 不自动修改商品详情页。
5. 不自动创建正式采购或补货单。
6. 不代替法务做最终合规判断。
7. 不做复杂多 Agent 框架。
8. 不做完整权限系统。
9. 不做真实 ERP 深度集成。
```

MVP 的边界是：

> **自动采集、自动诊断、自动模拟、自动建议、人工 Review，不自动越权执行。**

---

# 5. 用户角色

## 5.1 运营人员

核心用户。负责活动报名、商品筛选、平台运营。

关注点：

```text
哪些 SKU 能报名？
哪些 SKU 不能报名？
为什么不能报名？
怎么修？
哪些需要我确认？
```

---

## 5.2 商品管理人员

负责商品资料、珠宝属性、证书、标题、详情页完整性。

关注点：

```text
哪些商品信息不完整？
哪些商品证书缺失？
哪些字段影响活动或合规？
```

---

## 5.3 供应链 / 库存负责人

负责补货、库存分配、供应链准备。

关注点：

```text
哪些 SKU 库存不足？
补货多少能满足活动？
哪些 SKU 库存风险最高？
```

---

## 5.4 法务 / 风控 / 合规人员

负责合同、平台协议、活动规则、商品合规。

关注点：

```text
平台规则变化是否落到了执行检查？
哪些 SKU 触发风险？
哪些动作需要人工确认？
```

---

## 5.5 管理层 / 区域负责人

关注整体状态。

关注点：

```text
当前活动准备度如何？
各平台 SKU Ready 率如何？
哪些品类风险最高？
哪些问题阻碍活动执行？
```

---

# 6. 核心使用场景

## 场景 1：日常商品健康体检

运营打开电商后台商品列表页，浏览器插件扫描当前页面，采集 SKU 数据并发送到服务端。

系统输出：

```text
Ready SKU 数量
Repairable SKU 数量
Risky SKU 数量
Blocked SKU 数量
主要风险类型
优先修复建议
```

---

## 场景 2：活动规则发布后自动准入模拟

运营粘贴平台活动规则。

Agent 自动解析规则：

```text
销量门槛
库存门槛
好评率门槛
价格限制
类目数量限制
活动互斥规则
人工确认项
```

系统结合 SKU 健康档案，输出：

```text
可直接报名 SKU
可修复后报名 SKU
不建议报名 SKU
需要人工确认 SKU
```

---

## 场景 3：修复模拟

用户问：

```text
如果 G003 补货 200 件，会不会变成 Ready？
```

系统返回：

```text
当前库存：300
活动要求：≥500
补货 200 后库存达到 500
预计状态：Repairable → Direct Ready
建议：创建补货 Review 项
```

---

## 场景 4：合规规则转执行检查

D 风控合规 Agent 发现平台新增要求：

```text
高价值珠宝商品必须展示有效证书编号。
```

SKU Ready Agent 将其转为商品健康检查项。

输出：

```text
受影响 SKU：23 个
原本 Ready 但转为 Risky：7 个
已生成证书信息补全 Review 项：23 个
```

---

## 场景 5：战略 Agent 调用执行可行性

A 战略 Agent 发现：

```text
韩国市场轻奢钻饰热度上升，建议做钻石耳饰活动。
```

SKU Ready Agent 查询内部 SKU 健康档案，返回：

```text
钻石耳饰 Ready：6 个
Repairable：5 个
Blocked：7 个

建议：
优先使用 D002、D005、D008。
D011、D012 补全证书后可作为备选。
D001 因好评率不足，不建议参加。
```

---

# 7. 产品信息架构

MVP 页面结构：

```text
1. Dashboard 总览页
2. 数据源连接器页
3. SKU 健康档案页
4. 活动规则与准入模拟页
5. Review 工作台
6. Agent Chat 聊天控制台
7. 报告页
```

---

# 8. 核心功能需求

---

## 8.1 数据源连接器

### 功能说明

数据源连接器负责从不同业务系统采集商品数据。MVP 阶段主要实现浏览器插件连接器，其他连接器在 UI 上作为扩展能力展示。

### 数据源类型

|数据源|接入方式|MVP 是否实现|
|---|---|---|
|模拟天猫后台|Plasmo 浏览器插件|是|
|京东后台|插件 / API|展示，不真实实现|
|ERP 系统|API / CSV|展示，不真实实现|
|CSV 报表|文件导入|可选|
|平台 API|官方 API|未来扩展|

### 需求

|编号|需求|优先级|
|---|---|---|
|CON-001|插件识别商品列表页|P0|
|CON-002|插件扫描当前页面 table|P0|
|CON-003|插件将字段映射为标准 SKU 字段|P0|
|CON-004|插件侧边栏展示采集预览|P0|
|CON-005|用户确认后发送到服务端 `/api/ingest`|P0|
|CON-006|Dashboard 展示数据源连接状态|P1|
|CON-007|支持不同平台 adapter 切换|P1|
|CON-008|支持 CSV 导入|P2|

### 验收标准

```text
1. 用户打开模拟商品后台页面。
2. 点击插件“扫描当前页面”。
3. 插件能采集至少 10 条 SKU 数据。
4. 插件展示采集字段和数据质量。
5. 点击“发送到 Agent 分析”后，服务端成功入库。
```

---

## 8.2 数据标准化

### 功能说明

不同平台字段名不同，服务端需要统一为标准 SKU Snapshot。

示例：

```text
近30天销量 / 月销 / 销售出库数 → sales30d
好评率 / 用户满意度 → positiveRate
库存 / 可售库存 → stock
```

### 标准字段

|字段|说明|
|---|---|
|platform|平台|
|storeId|店铺 ID|
|skuId|SKU 编号|
|productName|商品名|
|category|类目|
|sales30d|近30天销量|
|positiveRate|好评率|
|stock|库存|
|originalPrice|原价|
|lowestPrice30d|近30天最低价|
|campaignPrice|活动价|
|joinedBrandDay|是否参加品牌日|
|certificateStatus|证书状态|
|materialStatus|材质信息状态|
|grossMargin|毛利率|
|collectedAt|采集时间|
|sourceUrl|数据来源页面|
|rawJson|原始数据|

### 需求

|编号|需求|优先级|
|---|---|---|
|NOR-001|服务端接收插件数据后进行 Zod 校验|P0|
|NOR-002|标准化字段名、数值和百分比|P0|
|NOR-003|保留原始 rawJson|P0|
|NOR-004|保留数据来源、采集时间、行号|P0|
|NOR-005|检测字段缺失和格式错误|P0|
|NOR-006|检测数据过期|P1|
|NOR-007|检测多源数据冲突|P2|

---

## 8.3 SKU 健康档案

### 功能说明

系统为每个 SKU 建立长期健康档案，记录商品快照、诊断结果、历史趋势、活动模拟结果和 Review 记录。

### 健康状态

```text
READY：可直接参加活动
REPAIRABLE：存在问题，但短期可修复
RISKY：存在风险，需要人工确认
BLOCKED：不建议参加活动
```

### 健康维度

|维度|检查内容|
|---|---|
|活动准入健康|销量、库存、好评率、价格、活动互斥|
|商品信息健康|标题、主图、详情页、属性完整性|
|珠宝专项健康|证书编号、材质、克重、钻石 4C|
|经营健康|毛利、动销、库存周转|
|风险健康|价格异常、证书缺失、售后异常|
|数据质量|字段完整性、来源、时效性、冲突|

### 需求

|编号|需求|优先级|
|---|---|---|
|SKU-001|商品入库后自动生成健康诊断|P0|
|SKU-002|计算 healthScore|P0|
|SKU-003|标记 healthStatus|P0|
|SKU-004|输出 issues 和 nextActions|P0|
|SKU-005|支持查看 SKU 详情|P0|
|SKU-006|支持查看历史趋势|P1|
|SKU-007|支持按品类、平台、状态筛选|P1|
|SKU-008|支持跨平台同 SKU 汇总|P2|

---

## 8.4 商品健康诊断规则

### MVP 诊断规则

|规则|状态影响|
|---|---|
|库存 < 500|Repairable|
|好评率 < 95%|Blocked|
|近30天销量 < 100|Blocked 或 Risky|
|活动价 > 近30天最低价|Risky|
|已参加品牌日|Blocked|
|证书信息缺失|Repairable / Risky|
|毛利率过低|Risky|
|商品信息缺失|Repairable|

### 输出示例

```json
{
  "skuId": "G003",
  "healthStatus": "REPAIRABLE",
  "healthScore": 72,
  "issues": [
    {
      "issueType": "inventory_risk",
      "severity": "medium",
      "message": "当前库存 300，低于活动安全库存 500。",
      "evidence": "stock=300",
      "repairable": true
    }
  ],
  "nextActions": [
    {
      "actionType": "replenish_stock",
      "targetField": "stock",
      "currentValue": 300,
      "targetValue": 500,
      "expectedEffect": "补货后可提升活动准入状态"
    }
  ]
}
```

---

## 8.5 活动规则解析

### 功能说明

用户粘贴活动规则文本，Agent 使用 Vercel AI SDK 调用模型，将自然语言规则解析为结构化规则。

### 输入示例

```text
天猫618大促规则：
近30天销量≥100件；
好评率≥95%；
库存≥500件；
活动价不得高于近30天最低价；
黄金类目最多5个SKU；
已参加品牌日的商品不可重复报名；
折扣力度≥7折。
```

### 输出示例

```json
{
  "activityName": "天猫618大促",
  "rules": [
    {
      "id": "R001",
      "type": "threshold",
      "field": "sales30d",
      "operator": ">=",
      "value": 100,
      "evidence": "近30天销量≥100件",
      "confidence": 0.96
    },
    {
      "id": "R002",
      "type": "threshold",
      "field": "positiveRate",
      "operator": ">=",
      "value": 0.95,
      "evidence": "好评率≥95%",
      "confidence": 0.97
    }
  ],
  "manualReviewItems": [
    {
      "item": "折扣力度≥7折",
      "reason": "折扣计算口径存在歧义，需要人工确认。",
      "evidence": "折扣力度≥7折",
      "confidence": 0.7
    }
  ]
}
```

### 需求

|编号|需求|优先级|
|---|---|---|
|ACT-001|支持粘贴活动规则文本|P0|
|ACT-002|使用 LLM 解析结构化规则|P0|
|ACT-003|LLM 输出必须通过 Zod 校验|P0|
|ACT-004|每条规则必须带 evidence|P0|
|ACT-005|低置信度规则进入 manualReviewItems|P0|
|ACT-006|解析失败时进入 Review，不自动执行|P0|
|ACT-007|支持规则库保存|P1|

---

## 8.6 活动准入模拟

### 功能说明

系统将活动规则与 SKU 健康档案匹配，判断 SKU 活动准入状态。

### 准入状态

```text
DIRECT_READY：可直接报名
REPAIRABLE_READY：修复后可报名
MANUAL_REVIEW：需要人工确认
BLOCKED：不建议报名
```

### 输出示例

|SKU|状态|原因|修复建议|
|---|---|---|---|
|G001|DIRECT_READY|满足所有规则|加入候选清单|
|G003|REPAIRABLE_READY|库存 300，要求 ≥500|补货至 500+|
|D001|BLOCKED|好评率 93%，低于 95%|不建议报名|
|G004|MANUAL_REVIEW|证书缺失|补全证书并人工确认|
|G006|BLOCKED|已参加品牌日|排除本次活动|

### 需求

|编号|需求|优先级|
|---|---|---|
|SIM-001|对每个 SKU 执行活动规则判断|P0|
|SIM-002|输出准入状态|P0|
|SIM-003|输出失败规则和证据|P0|
|SIM-004|输出修复计划|P0|
|SIM-005|支持类目数量限制|P1|
|SIM-006|支持按毛利率、销量、库存排序|P1|
|SIM-007|支持“如果补货/改价后会怎样”的模拟|P1|

---

## 8.7 Review 工作台

### 功能说明

所有不确定、高风险、需要跨部门确认的事项进入 Review 工作台。

### Review 来源

```text
数据缺失
规则歧义
模型低置信度
高风险动作
证书缺失
价格口径不清
活动互斥
来自 D 风控 Agent 的风险规则
来自 A 战略 Agent 的策略约束
```

### Review 项结构

```json
{
  "reviewType": "operation_decision",
  "skuId": "G003",
  "question": "是否为 G003 创建补货任务，使库存达到 500 件以上？",
  "agentRecommendation": "建议补货 200 件后加入 618 活动候选。",
  "riskIfIgnored": "若不补货，该 SKU 无法满足活动库存门槛。",
  "status": "PENDING"
}
```

### 需求

|编号|需求|优先级|
|---|---|---|
|REV-001|自动生成 Review 项|P0|
|REV-002|Review 项显示原因、证据、建议|P0|
|REV-003|用户可批准 / 驳回 / 修改|P1|
|REV-004|Review 决策记录入库|P1|
|REV-005|支持按类型和状态筛选|P1|
|REV-006|支持法务 / 运营 / 商品不同角色 Review|P2|

---

## 8.8 Agent Chat 聊天控制台

### 功能说明

聊天框不是普通问答，而是自然语言控制台。用户可以通过聊天查询 SKU 状态、解释诊断结果、发起模拟、生成报告。

### 示例问题

```text
为什么 G003 不能报名？
如果 G003 补货 200 件会怎样？
当前健康风险最多的是哪类？
帮我生成 618 活动 Review 清单。
把可报名 SKU 按毛利率排序。
哪些钻石 SKU 缺证书？
```

### 工具调用

聊天 Agent 必须通过工具调用真实业务数据：

```text
getHealthSummary
getSkuHealthDetail
parseActivityRules
simulateActivityEligibility
generateReviewItems
generateActivityReport
```

### 需求

|编号|需求|优先级|
|---|---|---|
|CHAT-001|使用 assistant-ui 展示聊天框|P0|
|CHAT-002|使用 Vercel AI SDK streamText|P0|
|CHAT-003|支持 tool calling|P0|
|CHAT-004|Agent 查询 SKU 时必须调用工具|P0|
|CHAT-005|Agent 不能凭空编造商品状态|P0|
|CHAT-006|聊天回复包含原因、证据和建议|P0|
|CHAT-007|显示工具调用过程|P1|

---

## 8.9 报告生成

### 功能说明

系统生成活动准入与商品健康报告。

### 报告结构

```text
一、商品健康总览
二、主要风险
三、活动准入结果
四、可直接报名 SKU
五、可修复后报名 SKU
六、不建议报名 SKU
七、人工 Review 清单
八、下一步行动建议
九、证据与数据来源
```

### 需求

|编号|需求|优先级|
|---|---|---|
|REP-001|生成 Markdown 报告|P0|
|REP-002|报告包含健康总览|P0|
|REP-003|报告包含活动准入结果|P0|
|REP-004|报告包含 Review 清单|P0|
|REP-005|报告包含证据链|P1|
|REP-006|支持导出 PDF / Excel|P2|

---

## 8.10 外部 Agent 互补能力

### 功能说明

SKU Ready Agent 可接收来自 A 战略 Agent 和 D 风控合规 Agent 的信号，并将其转化为执行判断和运营任务。

### 外部 Agent 信号类型

```text
MARKET_OPPORTUNITY：市场机会
POLICY_CHANGE：平台政策变化
CONTRACT_RISK：合同风险
ACTIVITY_RULE：活动规则
SKU_HEALTH_ALERT：商品健康预警
```

### MVP 展示方式

Dashboard 上展示两个模拟外部 Agent 信号：

```text
来自战略 Agent：
韩国市场钻饰热度上升，建议筛选可执行钻石 SKU。

来自风控合规 Agent：
平台新增高价值珠宝商品证书展示要求，请检查证书信息完整性。
```

点击后 SKU Ready Agent 输出执行结果。

### 需求

|编号|需求|优先级|
|---|---|---|
|EXT-001|UI 展示外部 Agent 信号卡片|P1|
|EXT-002|支持战略信号转 SKU 可执行性查询|P1|
|EXT-003|支持合规信号转商品检查项|P1|
|EXT-004|支持 `/api/agent-events`|P2|
|EXT-005|支持统一规则库导入|P2|

---

# 9. 安全与异常处理需求

这是独立加分模块，必须在 Demo 和路演中展示。

## 9.1 安全原则

```text
1. LLM 负责理解和表达，不直接做最终业务判断。
2. 准入判断由规则引擎执行。
3. 所有输入和 LLM 输出必须经过 Zod 校验。
4. 不确定、低置信度、数据缺失、规则歧义进入人工 Review。
5. 高风险动作不自动执行。
6. 所有结论必须可追踪证据链。
7. 系统采用 fail-closed 策略：不确定就不自动通过。
```

---

## 9.2 风险类型

|风险类型|示例|处理策略|
|---|---|---|
|数据风险|字段缺失、数据过期、来源冲突|标记异常，进入 Review|
|模型风险|LLM 解析失败、低置信度、幻觉|Zod 校验，重试，失败后 Review|
|规则风险|口径不清、规则冲突|manualReviewItems|
|操作风险|改价、提交报名、修改商品|禁止自动执行|
|权限风险|读取 Cookie、Token、无权限页面|明确禁止|
|Prompt Injection|页面内容中含恶意指令|页面内容作为数据，不作为指令|

---

## 9.3 异常处理矩阵

|异常场景|识别方式|处理策略|输出|
|---|---|---|---|
|插件无法识别表格|无 table 或字段不匹配|提示失败，允许 CSV 导入|采集失败|
|字段缺失|Zod 校验 / 数据质量检查|不自动通过|INSUFFICIENT_DATA|
|数据过期|collectedAt 超过阈值|需要重新采集|STALE_DATA|
|多源数据冲突|ERP 与平台数据差异大|人工确认|CONFLICTING_DATA|
|LLM 输出不合规|Zod parse 失败|重试一次，失败 Review|PARSE_FAILED|
|规则歧义|LLM 标记 manualReviewItems|不自动判断|Review|
|高风险动作|动作类型为改价/提交|禁止自动执行|HUMAN_APPROVAL_REQUIRED|
|网络失败|请求失败|重试 + 记录日志|FAILED|
|数据库失败|Prisma error|workflow 标记失败|FAILED|

---

## 9.4 权限分级

|等级|类型|是否自动执行|
|---|---|---|
|Level 1|只读查询，如健康总览、SKU 详情|可以|
|Level 2|建议类动作，如补货建议、证书补全建议|可以生成建议|
|Level 3|高风险动作，如改价、提交报名、修改商品|必须人工确认，MVP 不执行|

---

## 9.5 安全 UI 要求

Dashboard 必须显示：

```text
数据质量卡片
证据链按钮
异常与待确认中心
Review Gate
工作流执行日志
```

示例：

```text
数据质量：92/100
采集来源：天猫后台插件
采集时间：10 分钟前
缺失字段：0
冲突字段：0
```

---

# 10. 技术架构

## 10.1 技术栈

```text
语言：TypeScript
前端：Next.js
聊天 UI：assistant-ui
模型调用：Vercel AI SDK
插件：Chrome Extension / Plasmo
数据库：PostgreSQL
校验：Zod
ORM：Prisma
编排：手写 typed workflow
长期升级：Mastra / LangGraph.js / Inngest / Vercel Workflows
```

---

## 10.2 系统架构

```text
Client Layer
├── Next.js Dashboard
├── assistant-ui Chat
└── Chrome Extension / Plasmo

Connector Layer
├── Browser Plugin Connector
├── Platform API Connector
├── ERP Connector
└── CSV Connector

Server Core
├── Data Normalizer
├── SKU Health Profile
├── Health Diagnosis Engine
├── Activity Rule Parser
├── Activity Simulator
├── Review Generator
├── Report Generator
└── Safety & Reliability Layer

Agent Runtime
├── Vercel AI SDK
├── Tool Calling
├── Structured Output
└── Typed Workflow
```

---

## 10.3 Workflow

### Ingest Workflow

```text
插件采集数据
    ↓
Zod 校验
    ↓
数据标准化
    ↓
写入 SKU Snapshot
    ↓
商品健康诊断
    ↓
生成健康档案
    ↓
生成异常 / 预警 / Review 项
```

### Activity Workflow

```text
输入活动规则
    ↓
LLM 解析结构化规则
    ↓
Zod 校验 LLM 输出
    ↓
规则引擎执行活动准入模拟
    ↓
Safety Guard 检查不确定性
    ↓
生成准入结果
    ↓
生成 Review 清单
    ↓
生成活动报告
```

---

# 11. 数据模型

## 11.1 核心实体

```text
Connector
SkuSnapshot
SkuHealthDiagnosis
ActivityRuleSet
ActivitySimulationResult
ReviewItem
WorkflowRun
WorkflowStep
AgentEvent
```

---

## 11.2 Prisma 模型概要

### Connector

```text
id
name
connectorType
platform
storeId
status
createdAt
updatedAt
```

### SkuSnapshot

```text
id
connectorId
platform
storeId
skuId
productName
category
sales30d
positiveRate
stock
originalPrice
lowestPrice30d
campaignPrice
joinedBrandDay
certificateStatus
materialStatus
grossMargin
sourceUrl
rowIndex
rawJson
collectedAt
createdAt
```

### SkuHealthDiagnosis

```text
id
skuId
snapshotId
healthStatus
healthScore
issuesJson
nextActionsJson
createdAt
```

### ActivityRuleSet

```text
id
activityName
platform
ruleText
rulesJson
manualReviewJson
createdAt
```

### ActivitySimulationResult

```text
id
activityId
snapshotId
skuId
status
failedRulesJson
repairPlanJson
explanation
createdAt
```

### ReviewItem

```text
id
activityId
skuId
reviewType
question
agentRecommendation
riskIfIgnored
status
decision
comment
createdAt
updatedAt
```

### WorkflowRun

```text
id
workflowName
status
inputJson
outputJson
startedAt
finishedAt
```

### WorkflowStep

```text
id
runId
stepName
status
inputJson
outputJson
errorMessage
startedAt
finishedAt
```

### AgentEvent

```text
id
sourceAgent
eventType
title
description
payloadJson
createdAt
```

---

# 12. API 设计

## 12.1 数据接入

```http
POST /api/ingest
```

用途：

```text
接收插件 / API / CSV / ERP 传入的 SKU 数据。
```

返回：

```json
{
  "runId": "run_001",
  "snapshotCount": 10,
  "diagnosisCount": 10,
  "warnings": []
}
```

---

## 12.2 健康总览

```http
GET /api/health/summary
```

返回：

```json
{
  "totalSkus": 1280,
  "ready": 426,
  "repairable": 312,
  "risky": 89,
  "blocked": 133,
  "topIssues": [
    {
      "issueType": "inventory_risk",
      "count": 88
    }
  ]
}
```

---

## 12.3 SKU 详情

```http
GET /api/skus/{skuId}
```

返回：

```json
{
  "skuId": "G003",
  "productName": "古法金戒指",
  "healthStatus": "REPAIRABLE",
  "healthScore": 72,
  "issues": [],
  "nextActions": [],
  "evidence": []
}
```

---

## 12.4 活动规则解析

```http
POST /api/activities/parse
```

请求：

```json
{
  "activityName": "天猫618大促",
  "ruleText": "近30天销量≥100；库存≥500..."
}
```

---

## 12.5 活动准入模拟

```http
POST /api/activities/simulate
```

请求：

```json
{
  "activityId": "activity_001"
}
```

返回：

```json
{
  "summary": {
    "directReady": 3,
    "repairableReady": 2,
    "manualReview": 1,
    "blocked": 5
  },
  "results": []
}
```

---

## 12.6 Review

```http
GET /api/reviews
POST /api/reviews/{id}/decision
```

---

## 12.7 Chat

```http
POST /api/chat
```

用途：

```text
assistant-ui 聊天接口，支持 Vercel AI SDK streaming 和 tool calling。
```

---

## 12.8 报告生成

```http
POST /api/reports
```

---

## 12.9 外部 Agent 事件

```http
POST /api/agent-events
```

用途：

```text
接收 A 战略 Agent 或 D 风控合规 Agent 的外部信号。
```

---

# 13. 页面设计

## 13.1 Dashboard 总览页

展示：

```text
数据源连接状态
SKU 健康总览
主要风险
最近工作流运行记录
外部 Agent 信号
Agent Chat
```

关键卡片：

```text
监控 SKU：1280
Ready：426
Repairable：312
Risky：89
Blocked：133
数据质量：92/100
```

---

## 13.2 插件侧边栏

展示：

```text
当前页面识别结果
可采集字段
扫描按钮
采集预览
发送到 Agent 分析按钮
数据质量预估
```

---

## 13.3 SKU 健康档案页

展示：

```text
SKU 基本信息
健康状态
健康分
问题列表
证据链
历史趋势
下一步建议
```

---

## 13.4 活动规则与准入模拟页

展示：

```text
活动规则输入框
解析后的结构化规则
manualReviewItems
准入模拟结果
可报名 / 可修复 / 不建议报名列表
```

---

## 13.5 Review 工作台

展示：

```text
待确认事项
建议动作
风险说明
证据链
批准 / 驳回 / 修改按钮
```

---

## 13.6 Agent Chat

展示：

```text
聊天输入框
流式回复
工具调用过程
证据引用
建议动作
```

---

# 14. MVP Demo 数据设计

## 14.1 示例 SKU

|SKU|商品名|类目|销量|好评率|库存|活动状态|证书|
|---|---|---|--:|--:|--:|---|---|
|G001|足金手链|黄金|180|97%|800|未报名|完整|
|G002|黄金吊坠|黄金|80|98%|900|未报名|完整|
|G003|古法金戒指|黄金|200|99%|300|未报名|完整|
|D001|钻石耳钉|钻石|150|93%|700|未报名|完整|
|G004|足金项链|黄金|220|96%|900|未报名|缺失|
|G006|黄金耳钉|黄金|160|96%|650|品牌日|完整|
|D002|钻石项链|钻石|230|96%|1200|未报名|完整|

---

## 14.2 示例活动规则

```text
天猫618大促规则：

1. 参与商品必须满足近30天销量≥100件。
2. 好评率≥95%。
3. 库存≥500件。
4. 活动价不得高于近30天最低价。
5. 黄金类目单店最多5个SKU。
6. 已参加品牌日活动的商品不可重复报名。
7. 折扣力度≥7折。
```

---

## 14.3 故意设计的异常

```text
G002：销量不足
G003：库存不足但可补货
D001：好评率不足，短期不可修
G004：证书缺失
G006：品牌日互斥
规则“折扣力度≥7折”：口径歧义
```

---

# 15. MVP 开发优先级

## P0：必须完成

```text
1. 模拟电商后台页面
2. Plasmo 插件扫描商品表
3. /api/ingest 接收数据
4. PostgreSQL 存 SKU Snapshot
5. 商品健康诊断
6. 活动规则解析
7. 活动准入模拟
8. Review 清单
9. assistant-ui 聊天框
10. 聊天框能查询 SKU 状态和解释原因
11. 数据质量 / 证据链 / Review Gate 展示
```

---

## P1：强烈建议完成

```text
1. 数据源连接器卡片
2. 外部 Agent 信号卡片
3. 一键生成活动报告
4. 工具调用 trace
5. 工作流日志
6. 修复模拟：“如果补货 200 件会怎样”
7. 类目上限排序
```

---

## P2：未来扩展

```text
1. 真实平台 API
2. ERP 深度集成
3. 定时巡检
4. 多平台同 SKU 汇总
5. 多角色权限
6. Mastra / LangGraph.js / Inngest / Vercel Workflows
7. 报告导出 PDF / Excel
8. 自动创建补货任务，但必须人工确认
```

---

# 16. 明天开发排期

## 第 1 小时：项目骨架

```text
Next.js 项目
Prisma + PostgreSQL
Plasmo 插件项目
模拟商品后台页面
基础 UI
```

---

## 第 2-3 小时：插件采集

```text
扫描 table
adapter 字段映射
侧边栏预览
发送到 /api/ingest
```

---

## 第 4 小时：服务端数据与健康诊断

```text
Zod 校验
Prisma 入库
health diagnosis
Dashboard 健康总览
```

---

## 第 5 小时：活动规则解析

```text
Vercel AI SDK generateObject
Zod 校验 LLM 输出
fallback demo rules
manualReviewItems
```

---

## 第 6 小时：准入模拟与 Review

```text
activity simulator
repair plan
review generator
Review 工作台
```

---

## 第 7 小时：聊天框

```text
assistant-ui
/api/chat
tools:
- getHealthSummary
- getSkuHealthDetail
- simulateActivity
- generateReport
```

---

## 第 8 小时：安全与异常展示

```text
数据质量卡片
证据链按钮
工作流日志
异常中心
Review Gate
```

---

## 最后：路演打磨

```text
Demo 顺序
故事线
A/C/D 互补
安全可靠性
最终报告
```

---

# 17. Demo 脚本

## Step 1：讲痛点

> 活动报名的难点不只是规则复杂，而是数据分散、准备滞后。运营往往在活动来了以后才临时拉数据、筛 SKU，但这时候库存不足、好评率下降、证书缺失、活动互斥等问题已经来不及修。

---

## Step 2：打开模拟电商后台

展示商品列表。

---

## Step 3：打开浏览器插件

点击：

```text
扫描当前商品页
```

插件显示：

```text
已采集 10 个 SKU
数据质量：92/100
发现初步风险：库存不足 2 个，好评率不足 1 个，证书缺失 1 个
```

---

## Step 4：发送到 Agent

服务端 Dashboard 显示：

```text
Ready：3
Repairable：3
Risky：2
Blocked：2
```

---

## Step 5：粘贴活动规则

Agent 解析为结构化规则，并指出：

```text
“折扣力度≥7折”存在口径歧义，需要人工确认。
```

---

## Step 6：活动准入模拟

输出：

```text
可直接报名：3 个
修复后可报名：2 个
不建议报名：5 个
需要人工确认：1 项
```

---

## Step 7：Review 工作台

展示：

```text
是否为 G003 创建补货任务？
是否为 G004 补全证书信息？
是否排除 G006 品牌日互斥商品？
折扣力度≥7折的口径是否确认？
```

---

## Step 8：聊天框提问

输入：

```text
为什么 G003 不能报名？如果补货 200 件会怎样？
```

Agent 返回：

```text
G003 当前库存 300，活动要求库存 ≥500，因此当前不能直接报名。
如果补货 200 件，库存达到 500，可从 Repairable 转为 Direct Ready。
建议创建补货 Review 项。
证据：库存字段来自天猫后台插件，采集时间为 xx；规则证据为“库存≥500件”。
```

---

## Step 9：展示 A/D 互补

展示两个外部 Agent 信号：

```text
战略 Agent：韩国市场钻饰热度上升。
风控 Agent：平台新增高价值珠宝证书展示要求。
```

SKU Ready Agent 响应：

```text
钻石类 Ready SKU：3 个。
证书缺失 SKU：12 个，已生成补全 Review 项。
```

---

# 18. 路演核心话术

## 18.1 产品价值

> 我们没有做一个活动来了才临时筛 SKU 的工具，而是做了一个 SKU Ready Agent。它平时通过多源数据连接器采集商品数据，持续维护商品健康档案；活动规则发布后，再自动解析规则并模拟准入结果。真正的减负不是替代 Excel 过滤，而是让商品在活动来临前就保持 Ready。

---

## 18.2 技术价值

> 我们采用 TypeScript-first 架构，前端是 Next.js，聊天 UI 使用 assistant-ui，模型调用使用 Vercel AI SDK，插件使用 Plasmo，数据库是 PostgreSQL，ORM 是 Prisma，Zod 负责所有输入和 LLM 输出校验。编排上先使用 typed workflow，保证黑客松 Demo 稳定，未来可以升级到 Mastra、LangGraph.js、Inngest 或 Vercel Workflows。

---

## 18.3 AI 安全

> 我们没有让大模型直接做业务决策。LLM 负责规则解析和表达，规则引擎负责准入判断，Safety Layer 负责校验、不确定性处理和人工 Review。只要出现数据缺失、规则歧义、低置信度、来源冲突或高风险动作，系统不会自动通过，而是生成带证据的 Review 项。

---

## 18.4 多 Agent 互补

> A 战略 Agent 看市场机会，D 风控合规 Agent 看规则边界，而 C SKU Ready Agent 负责把机会和边界落到 SKU、库存、价格、证书、活动状态和运营任务上。战略没有执行反馈就是空中楼阁，合规没有执行任务就是纸面风险，我们的 C 方案就是企业 Agent 体系里的执行底座。

---

# 19. 成功指标

## MVP 指标

```text
插件能采集 ≥10 个 SKU
服务端能成功入库
健康诊断能区分 Ready / Repairable / Blocked
活动规则能解析为结构化规则
活动准入模拟能输出原因和修复建议
Review 清单能生成
聊天框能通过工具查询真实数据
安全模块能展示数据质量、证据链和人工 Review
```

---

## 产品化指标

|指标|说明|
|---|---|
|SKU Ready 率|可直接参加活动的 SKU 占比|
|Repairable 转 Ready 率|修复后成功转为 Ready 的比例|
|活动报名失败率|报名失败或返工比例|
|数据自动采集覆盖率|自动采集数据占全部数据比例|
|Review 处理时效|Review 项从生成到决策的时间|
|异常拦截率|数据缺失、歧义、低置信度被正确拦截比例|
|运营节省时间|相比人工 Excel 筛选减少的时间|

---

# 20. 风险与应对

|风险|应对|
|---|---|
|插件采集失败|提供模拟后台和 CSV fallback|
|LLM 解析不稳定|使用 Zod 结构化输出 + fallback demo rules|
|Demo 网络不稳定|准备本地规则 JSON|
|数据库配置复杂|预先准备本地 PostgreSQL 或托管数据库|
|assistant-ui 集成耗时|先做简单聊天接口，后补 UI 美化|
|评委质疑爬虫合规|强调插件只读取授权页面，不绕过登录，不读取 Cookie/Token|
|评委质疑 Excel 也能做|强调自动采集、长期监控、预警、模拟、Review，而不是一次性筛选|
|评委质疑 AI 不确定性|展示 Safety Layer、证据链、Zod 校验、Review Gate|

---

# 21. 开放问题

明天现场需要向导师确认：

```text
1. C 题是否允许我们把执行辅助扩展为商品健康监控？
2. 是否允许使用模拟电商后台？
3. 是否更看重 Demo 可运行，还是 Agent 架构设计？
4. 是否允许使用浏览器插件作为数据连接器？
5. 是否有真实 SKU 数据或活动规则样例？
6. 是否需要考虑企业内部 ERP 数据？
7. 安全和异常处理是否作为单独评分项？
8. 是否鼓励展示和 A / D 方案的互补关系？
```

---

# 22. 最终结论

SKU Ready Agent 的核心不是“规则解析”，也不是“Excel 替代品”，而是：

```text
多源数据自动汇聚
    ↓
SKU 健康档案长期维护
    ↓
商品问题提前预警
    ↓
活动规则自动解析
    ↓
活动准入模拟
    ↓
修复建议生成
    ↓
人工 Review
    ↓
执行反馈沉淀
```

最终定位：

> **SKU Ready Agent 是企业 Agent 体系中的运营执行层，把战略目标和风控规则转化为可执行的商品任务。**

最终杀手锏：

> **Excel 解决的是数据准备好之后怎么筛；SKU Ready Agent 解决的是数据如何自动汇聚、商品如何持续健康、活动来临前如何提前修复。**