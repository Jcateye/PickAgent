# PickAgent Architecture

> 本文件记录 PickAgent / SKU Ready Agent 的项目级技术架构、模块边界、数据主语、客户端职责与服务端分层。产品叙事见 `docs/PRD.md`，评审汇总见 `claude_prd_report.html`。
>
> Pi Agent Copilot 细化设计见 `docs/pi-agent-copilot-design.md`，Agent 后端数据结构与模块落位见 `docs/agent-backend-data-architecture.md`，Layer 3 到最终设计的收敛计划见 `docs/final-design-gap-closure.md`。

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
└── apps/frontend      # 集中式总控制台，包含人工工作台与 Agent Copilot 工作台

API / Application Layer
├── ingest API
├── sku / health query APIs
├── activity parse / simulation APIs
├── review APIs
├── report APIs
├── chat API
└── agent mission API

Agent Workbench Runtime Layer
├── PiAgentLoopAdapter       # Agent harness / loop runtime
├── VercelAiModelAdapter     # LLM provider / tool schema / streaming adapter
└── assistant-ui             # frontend conversation UI layer

Domain / Service Layer
├── IngestService
├── NormalizationService
├── HealthAssessmentService
├── ActivityRuleService
├── ActivitySimulationService
├── ReviewService
├── ReportService
├── SkuQueryService
├── ChatToolService
├── AgentMissionService
└── ExecutionPathPlanner

Persistence Layer
├── PostgreSQL
├── Prisma schema / migrations
└── Workflow / audit logs
```

### 2.1 Layer 3 后的目标状态

当前 Layer 3 已完成模块级可演示集成，但最终架构仍以 `docs/final-design-gap-closure.md` 为收口口径。进入 Layer 4 时，系统必须从“内存 runtime + mock fallback + route 骨架”收敛到以下形态：

- 插件采集通过真实 HTTP route 进入 `IngestService`，并在事务中生成 SKU 档案、快照、诊断和当前投影。
- 员工工作台默认消费真实 API DTO；mock 只保留为开发 fallback，不作为生产默认数据源。
- 员工工作台的首屏业务 DTO 必须由 server/API 提供稳定 snapshot，client component 不在 hydration 初始化阶段创建业务 runtime 或分配业务 ID。
- 活动模拟、Review 和报告必须共用后端 application service 和持久化对象，不在前端重新生成业务结论。
- Agent Copilot 必须从单独页面收敛为 Console layout 上的 Overlay / Sidecar，并通过 `WorkbenchContext` 读取当前页面对象。
- Agent runtime 必须通过 `AgentToolRegistry`、`AgentEventStore`、SSE 和 Review Gate 留下可恢复、可审计的执行链路。
- Evidence、source object、Review Gate、tool trace 和 report section 必须携带 `TraceableRef`，前端不能只展示不可点击的静态证据文本。

因此，Layer 4 的架构工作不是新增单点业务功能，而是完成 API route binding、repository / transaction、Copilot Overlay、Agent event stream 和端到端验收证据。

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
- Agent Copilot
- Workflows

职责：

- 展示服务端已生成的 current state
- 承载录入规则、查看模拟结果、审批 Review 等交互
- 提供 Agent Copilot 目标任务入口，展示 Agent Plan、Tool Trace、长任务状态、Context 对照和 Review Gate

边界：

- 不在前端重算健康状态、准入状态或规则结果
- 页面只读 DTO / projection，不直接拼底层事实模型
- 首屏 DTO 不在 client hydration 阶段即时生成；报告、Review、Agent run 等带 ID 的对象必须来自稳定 server snapshot 或持久化 API
- Evidence、来源对象、Review Gate 和报告章节必须渲染为可点击链接或详情抽屉，不允许空按钮
- Agent Copilot 不拥有私有业务逻辑，只编排与展示服务端 tools 的执行结果

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
- `AgentMissionService`：把用户目标、外部事件或 Dashboard trigger 建模为 Mission，管理计划、状态、长任务和 Review Gate
- `ExecutionPathPlanner`：把规则 DSL 转为字段需求、数据源、执行检查清单和决策路径

### 4.2.1 Agent Mission Layer

Mission Layer 位于 Chat / 外部 Agent Event / Dashboard Trigger 与系统原生 service 之间：

```txt
Chat / External Agent Event / Dashboard Trigger
        ↓
AgentMissionService
        ↓
ExecutionPathPlanner + ChatToolService
        ↓
Ingest / Health / Activity / Simulation / Review / Report Services
        ↓
WorkflowRun / WorkflowStep / Evidence / ReviewItem
```

MVP 中 Mission 不直接写业务结论。它负责：

- 识别目标、约束和自治等级
- 生成可见的 Agent Plan
- 选择已有系统工具并记录 Tool Trace
- 在数据过期、规则歧义、多源冲突或高风险动作时暂停并创建 Review
- 将长任务落到 `WorkflowRun` / `WorkflowStep`，便于回看、降级和恢复

当前 Agent 工作台确认采用 Pi 作为 Agent harness / loop runtime，Vercel AI SDK 负责 LLM provider、tool schema 与 streaming 适配，assistant-ui 负责前端会话 UI。Pi 只位于 `PiAgentLoopAdapter` 后面，不直接访问业务 service 或数据库；业务能力必须通过 `AgentToolRegistry` 暴露。

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
- UI 可追溯对象统一携带 `TraceableRef`，包含 `entityType`、`entityId`、`label`、`href?`、`drawerTarget?`
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
- 产品主形态是双工作台：人工工作台负责确定性业务操作，Agent Copilot 工作台负责目标驱动规划、原子工具调用、Trace、Context 对照和 Review Gate
- Agent 工作台运行时分工：Pi 负责 agent harness / loop，Vercel AI SDK 负责 LLM 与 tool schema，assistant-ui 负责会话 UI
- 浏览器插件是数据入口；总控制台是决策与协同入口

## 11. 待补 ADR

建议尽快落地到 `docs/adr/` 的主题：

1. `SkuProfile` 与 `CurrentSkuProjection` 的正式建模
2. Rule DSL 的最小类型与演进策略
3. Evidence / Review 的结构化模型
4. P0 范围收敛与前端页面优先级
