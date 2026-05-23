# PickAgent Architecture

> 本文件记录 PickAgent / SKU Ready Agent 的项目级技术架构、模块边界、数据主语、客户端职责与服务端分层。产品叙事见 `docs/PRD.md`，评审汇总见 `claude_prd_report.html`。

## 1. 项目目标

PickAgent 当前的目标是交付 **SKU Ready Agent**：

- 持续采集多平台商品数据
- 建立长期 SKU 健康档案
- 解析活动规则并做准入模拟
- 生成结构化 Review 项
- 通过插件和集中式总控制台提供执行与协同入口

这是一个 **企业 Agent 体系中的运营执行层**，不是一次性规则筛选工具，也不是普通聊天机器人。

## 2. 当前确认的总体架构

```txt
Client Layer
├── apps/extension     # 浏览器插件，负责采集与预览
└── apps/frontend      # 集中式总控制台，负责查询、模拟、Review、报告、Chat

API / Application Layer
├── ingest API
├── sku / health query APIs
├── activity parse / simulation APIs
├── review APIs
├── report APIs
└── chat API

Domain / Service Layer
├── IngestService
├── NormalizationService
├── HealthAssessmentService
├── ActivityRuleService
├── ActivitySimulationService
├── ReviewService
├── ReportService
├── SkuQueryService
└── ChatToolService

Persistence Layer
├── PostgreSQL
├── Prisma schema / migrations
└── Workflow / audit logs
```

## 3. 客户端拆分

### 3.1 浏览器插件：`apps/extension/`

职责：

- 识别商品列表页
- 扫描 DOM / table
- 做字段映射预览
- 显示采集层风险提示
- 提交 `/api/ingest`
- 成功后跳转总控制台或本次采集结果

不负责：

- 健康诊断
- 规则解析
- 活动准入模拟
- Review 决策
- 报告生成

### 3.2 集中式总控制台：`apps/frontend/`

建议页面：

- Dashboard
- Connectors
- SKU List
- SKU Detail
- Activities / Rule Parse
- Simulation Result
- Review Workbench
- Reports
- Chat
- Workflows

职责：

- 展示服务端已生成的 current state
- 承载录入规则、查看模拟结果、审批 Review 等交互
- 提供自然语言控制台入口

边界：

- 不在前端重算健康状态、准入状态或规则结果
- 页面只读 DTO / projection，不直接拼底层事实模型

## 4. 服务端分层

### 4.1 Route / API Layer

保持薄，只做：

- request parse
- auth / boundary validation
- 调用 service
- 返回 DTO

核心接口建议：

- `POST /api/ingest`
- `GET /api/health/summary`
- `GET /api/skus`
- `GET /api/skus/:skuProfileId`
- `POST /api/activities/parse`
- `POST /api/activities/:activityId/simulations`
- `GET /api/reviews`
- `POST /api/reviews/:id/decision`
- `POST /api/reports`
- `POST /api/chat`

### 4.2 Application Services

当前确认的服务拆分：

- `IngestService`：接收 rows、建档、写快照、触发诊断
- `NormalizationService`：平台字段到标准字段的归一化
- `HealthAssessmentService`：基于 snapshot 输出日常健康结论
- `ActivityRuleService`：规则解析、Zod 校验、Rule DSL 持久化
- `ActivitySimulationService`：准入模拟、what-if 重跑、集合规则处理
- `ReviewService`：生成 ReviewItem、处理审批决策
- `ReportService`：生成健康与活动报告 DTO
- `SkuQueryService`：提供 Dashboard、详情页、列表页读模型
- `ChatToolService`：把服务能力暴露为 Vercel AI SDK tools

### 4.3 Domain Engines

尽量纯业务判断：

- `HealthRuleEvaluator`
- `ItemRuleEvaluator`
- `SetRuleEvaluator`
- `EvidenceBuilder`

原则：

- 不夹带 HTTP
- 不夹带 ORM
- 不夹带页面语义

### 4.4 Repositories / Persistence

按聚合或主实体拆分：

- `SkuProfileRepository`
- `SkuSnapshotRepository`
- `DiagnosisRepository`
- `ActivityRuleSetRepository`
- `SimulationRepository`
- `ReviewRepository`
- `WorkflowRepository`

## 5. 核心数据主语与边界

### 5.1 长期主语

- `SkuProfile`：长期 SKU 档案主语
- `canonicalSkuKey`：MVP 建议为 `platform:storeId:externalSkuId`

### 5.2 采集事实

- `SkuSnapshot`：某次采集事实
- 保留 `rawJson`、`sourceUrl`、`rowIndex`、`collectedAt`

### 5.3 日常健康结论

- `SkuHealthDiagnosis`
- 只承载长期健康、数据质量、商品资料完整性、经营风险等结论

### 5.4 活动上下文结论

- `ActivityRuleSet`
- `ActivitySimulationRun`
- `ActivitySimulationResult`

必须与 `SkuHealthDiagnosis` 分开，不能把某次活动门槛污染为长期健康标准。

### 5.5 读模型

- `CurrentSkuProjection`

当前建议：进入 P0 正式模型，用于 Dashboard、SKU List、Chat summary、Report summary。

## 6. 状态模型

### 6.1 长期健康状态

- `READY`
- `REPAIRABLE`
- `RISKY`
- `BLOCKED`

### 6.2 活动准入状态

- `DIRECT_READY`
- `REPAIRABLE_READY`
- `MANUAL_REVIEW`
- `BLOCKED`

原则：

- `healthStatus` 与 `eligibilityStatus` 必须拆开
- `healthScore` 只能辅助展示，不推翻硬规则状态
- `dataQualityScore` 单独建模，不混入 `healthScore`

## 7. Rule DSL

当前确认的最小 Canonical Rule 类型：

- `threshold`
- `field_compare`
- `boolean_block`
- `data_required`
- `quota`
- `manual_review`

进一步拆分：

### Item-level rules

- 销量、库存、好评率
- 品牌日互斥
- 价格比较
- 证书 / 材质 / 克重 / 4C 等必填项

### Set-level rules

- 类目最多 N 个 SKU
- 店铺坑位限制
- 活动候选集合排序与截断

## 8. Evidence 与 Review

### 8.1 Evidence

P0 建议：

- 核心对象先保留 `evidenceJson`
- 至少包含：
  - `sourceType`
  - `sourceId`
  - `field`
  - `rawValue`
  - `normalizedValue`
  - `ruleId`
  - `evidenceText`
  - `collectedAt`

P1 再拆 `EvidenceRef` 独立表。

### 8.2 ReviewItem

P0 建议字段：

- `reviewType`
- `reasonCode`
- `status`
- `question`
- `agentRecommendation`
- `riskIfIgnored`
- `assigneeRole`
- `decision`
- `decisionComment`
- `decisionBy`
- `decidedAt`
- `evidenceJson`
- `skuProfileId?`
- `snapshotId?`
- `diagnosisId?`
- `activityRuleSetId?`
- `simulationResultId?`

原则：

- Review 是结构化任务，不是纯文本提示
- 不使用前端按钮隐藏来替代权限与审批边界

## 9. apps/ 目录落位

```txt
apps/
  frontend/     # 集中式总控制台
  extension/    # 浏览器插件
  backend/      # 后端实现、workflow、prisma、application/domain/infrastructure
  contracts/    # OpenAPI / errors / events / shared DTO / Zod schemas
```

### backend 当前建议目录

```txt
apps/backend/
  src/
    api/
    application/
    domain/
    infrastructure/
    workflow/
    tools/
    schemas/
    safety/
  prisma/
```

## 10. 当前已确认的工程结论

- 主报告采用 `claude_prd_report.html`
- 吸收 codex 报告的工程化补丁：
  - `CurrentSkuProjection` 升为 P0
  - `dataQualityScore` 进入正式模型
  - `scopeJson` 进入 simulation run
  - `llmModel / confidence / parseStatus` 进入 `ActivityRuleSet`
  - 金额字段使用 `Decimal`
- Chat 是自然语言控制台，不是核心业务判断层
- 浏览器插件是数据入口；总控制台是决策与协同入口

## 11. 待补 ADR

建议尽快落地到 `docs/adr/` 的主题：

1. `SkuProfile` 与 `CurrentSkuProjection` 的正式建模
2. Rule DSL 的最小类型与演进策略
3. Evidence / Review 的结构化模型
4. P0 范围收敛与前端页面优先级
