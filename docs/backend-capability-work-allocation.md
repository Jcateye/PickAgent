# 后端能力设计与分工：前端重做配套

日期：2026-05-24

关联文档：

- `docs/frontend-redesign-api-contract.md`
- `docs/architecture.md`
- `docs/engineering-rules.md`
- `docs/api-guidelines.md`
- `docs/db-guidelines.md`

## 1. 目标与边界

目标：支撑新版前端一级菜单完整复刻原型，并让页面消费稳定后端 DTO，而不是在前端重算业务结论。

新版一级菜单：

1. 概览
2. SKU列表
3. 活动管理
4. 任务与运行
5. Review工作台
6. 报告中心
7. 数据源
8. 规则库
9. 设置

P0 边界：

- 做真实 API route、DTO、application service、repository 边界。
- 后端统一生成页面所需 summary/detail/projection。
- Evidence、Rule、Run、Tool Trace、Review Gate 都返回可追溯引用。
- 不做自动改价、自动报名、自动修改商品信息。
- 不新增 NestJS、Redis、InsForge 或新的后端底座。

代码改动边界：

- 允许改：`apps/backend/`、`apps/contracts/`、`apps/frontend/src/app/api/`、`docs/`。
- 禁止改：`apps/frontend/src/modules/**`、`apps/frontend/src/app/(console)/**`、前端 UI 组件、CSS、页面实现。
- 说明：当前 Next API route handler 位于 `apps/frontend/src/app/api/`，物理路径属于 frontend，但职责上是后端入口层；后端任务可以修改该目录以暴露 API。

风险等级：整体为 `L2`。涉及 Prisma migration、生产鉴权、真实 Agent runtime 接线时升到 `L3`，需要单独确认后执行。

## 2. 后端能力分层

### 2.1 API / Route 层

职责：

- request parse
- Zod 校验
- auth / tenant boundary
- 调 application service
- 返回统一 `ApiEnvelope<T>`

新增 route group：

- `workbench`
- `dashboard`
- `activities`
- `agent`
- `reviews`
- `reports`
- `connectors`
- `rule-sets`
- `settings`

要求：

- route 不拼业务结论。
- route 不直接访问 Prisma。
- route 必须显式传入 `P0AuthContextDto`，不能继续默认 `explicitDevBoundary`。

### 2.2 Application Service 层

新增或扩展 service：

- `WorkbenchShellService`
- `DashboardOverviewService`
- `SkuReadinessQueryService`
- `ActivityManagementService`
- `ExecutionPathPlanner`
- `AgentMissionQueryService`
- `AgentRunService`
- `ReviewWorkbenchService`
- `ReportCenterService`
- `ConnectorManagementService`
- `BrowserConnectorService`
- `RuleSetService`
- `WorkspaceSettingsService`

要求：

- 页面 action 和 Agent tool 复用同一 service。
- DTO 聚合放在 service / assembler，不放 React 页面或 route。
- 写操作必须有 WorkflowRun / WorkflowStep 或 AgentToolCall 审计。

### 2.3 Domain / Engine 层

新增或加强 engine：

- `ReadinessChecklistBuilder`：为 SKU 详情抽屉生成准入要点。
- `EvidenceRefBuilder`：从 snapshot、diagnosis、rule、simulation、review、tool call 构造字段级 evidence。
- `RequiredFieldExtractor`：从 Rule DSL 提取所需字段和数据源。
- `DataAvailabilityEvaluator`：检查字段是否 ready/missing/stale/external/ambiguous。
- `RunStepPlanner`：生成执行路径的 6 步计划。
- `ReportSectionAssembler`：从 simulation/review/evidence 聚合报告 tabs。
- `ReviewRecommendationBuilder`：根据风险类型生成建议内容、指标和审批问题。

要求：

- 纯业务逻辑，不夹 HTTP，不夹 ORM。
- 活动准入状态不覆盖长期健康状态。

### 2.4 Repository / Persistence 层

现有表可继续使用：

- `Connector`
- `SkuProfile`
- `SkuSnapshot`
- `SkuHealthDiagnosis`
- `CurrentSkuProjection`
- `ActivityRuleSet`
- `ActivitySimulationRun`
- `ActivitySimulationResult`
- `ReviewItem`
- `WorkflowRun`
- `WorkflowStep`
- `AgentSession`
- `AgentMission`
- `AgentRun`
- `AgentMessage`
- `AgentRunEvent`
- `AgentToolCall`
- `AgentReviewGate`

建议新增 P0 表：

- `Activity`：活动主对象，承载活动名称、范围、状态、时间窗、当前规则集、最新运行。
- `RuleSetVersion`：规则库版本。若短期压缩，可先用 `ActivityRuleSet.parseMetadataJson.version` 过渡。
- `Report` / `ReportVersion`：报告中心列表、版本、导出状态。若短期压缩，可先用 `WorkflowRun(outputJson)` 过渡。
- `ConnectorRun`：数据源最近采集运行、行数、质量分、告警。若短期压缩，可先用 `WorkflowRun(workflowType=connector_sync)` 过渡。
- `WorkspaceSetting`：工作区阈值、Review SLA、tool policy。若短期压缩，可先用静态 config + settings route。

L3 注意：

- 新表 migration 属于结构变更，执行前需要确认。
- 不建议一开始拆独立 `EvidenceRef` 表，P0 先用 JSON evidence refs，字段结构必须满足 `EvidenceRef`。

### 2.5 P0 数据库初始化复核（2026-05-24）

当前结论：P0 建议新增的核心存储已经覆盖，没有漏掉本分工里定义的主对象表。

已初始化并在 Prisma schema 中存在：

- `activities`：覆盖活动主对象。
- `rule_set_versions`：覆盖规则版本。
- `connector_runs`：覆盖数据源采集运行。
- `reports`：覆盖报告中心主对象。
- `report_versions`：覆盖报告版本快照。
- `workspace_settings`：覆盖工作区阈值、Review SLA、tool policy。

已确认的初始化数据：

- `workspace_settings: agent/tool_policy`
- `workspace_settings: workspace/freshness_thresholds`
- `workspace_settings: workspace/review_sla`

不需要为 P0 立即新增的表：

- `EvidenceRef` 独立表：P0 继续使用 `evidence_refs_json` / `evidence_json`，避免过早拆证据模型。
- `ReportSubscription` 独立表：P0 使用 `reports.subscription_json`。
- `ExportJob` 独立表：P0 使用 `reports.export_status` 和 `report_versions.export_artifacts_json` 表达导出状态与产物。
- `Notification` 独立表：概览通知数先从 review、run、connector 状态派生。
- `RunQuestion` 独立表：任务内问答先复用 `agent_messages`。

P0.5 / P1 需要补强的关系与实现：

- `reports.latest_version_id` 当前是普通 UUID 字段，没有外键或 Prisma relation；P0 服务层可用 `report_versions(report_id, max(version))` 兜底，后续建议补 FK 或移除该冗余字段。
- `activity_simulation_runs` 只关联 `activity_rule_set_id`，没有直接 `activity_id`；P0 可通过 `activities.current_rule_set_id` 或 report/activity 上下文回查，后续若要稳定展示历史活动运行，建议补 `activity_id`。
- `connector_runs` 没有直接关联入库批次或 `sku_snapshots`；P0 可通过 `workflow_run_id` 和 `summary_json` 记录批次摘要，后续若要做强 Trace，建议给快照或 ingest batch 增加 `connector_run_id`。
- `POST /api/activities/{activityId}/candidate-skus` 没有独立候选清单表；P0 可以先把候选范围写入 `activities.summary_json` 或由 simulation results 派生，后续若要人工维护候选池，建议新增 `activity_candidate_skus`。
- 当前 P0 表解决的是持久化底座；页面可用接口仍需要补 DTO、application service、repository 聚合和 Next API route handler，不能只暴露生成式 CRUD。

## 3. 菜单到能力映射

### 3.1 概览

接口：

- `GET /api/workbench/shell`
- `GET /api/dashboard/overview`

后端能力：

- 聚合 SKU readiness KPI。
- 聚合最新活动和 run 进度。
- 聚合风险摘要。
- 聚合待办 Review。
- 聚合数据源 freshness。

Service：

- `WorkbenchShellService`
- `DashboardOverviewService`

Repository：

- `CurrentSkuProjectionRepository`
- `ActivityRepository`
- `AgentRunRepository`
- `ReviewRepository`
- `ConnectorRunRepository`

验收：

- 返回一个页面首屏所需 DTO，不要求前端再调 5 个接口拼首屏。
- 数据新鲜度、通知数、待办数与对应列表接口一致。

### 3.2 SKU列表

接口：

- `GET /api/skus`
- `GET /api/skus/{skuProfileId}`
- `POST /api/skus/bulk-review-items`
- `POST /api/skus/export`
- `POST /api/activities/{activityId}/candidate-skus`

后端能力：

- 扩展 `CurrentSkuProjection` 读模型，返回健康状态、活动准入状态、下一步动作、证据数量。
- 详情抽屉返回 readiness checklist、evidence overview、相关规则、相关 Review。
- 批量创建 Review。
- 创建活动候选清单，不执行真实平台报名。

Service：

- `SkuReadinessQueryService`
- `ReadinessChecklistBuilder`
- `ReviewWorkbenchService`

Repository：

- `CurrentSkuProjectionRepository`
- `SkuSnapshotRepository`
- `SkuHealthDiagnosisRepository`
- `ActivitySimulationResultRepository`
- `ReviewRepository`

验收：

- SKU list 可按平台、类目、健康状态、活动准入状态、证书状态过滤。
- SKU detail 的每个 checklist item 都有 evidence refs。
- `加入活动` 不越权，只创建候选或建议。

### 3.3 活动管理

接口：

- `GET /api/activities`
- `POST /api/activities`
- `GET /api/activities/{activityId}`
- `PATCH /api/activities/{activityId}`
- `POST /api/activities/{activityId}/rule-sets/parse`
- `GET /api/activities/{activityId}/execution-plan`
- `POST /api/activities/{activityId}/runs`
- `POST /api/activities/{activityId}/simulations`
- `GET /api/activities/{activityId}/simulations/{simulationRunId}`

后端能力：

- 建立 Activity 主对象。
- 解析活动规则为 Rule DSL。
- 提取 required fields。
- 检查数据源可用性与字段 freshness。
- 生成 6 步执行路径。
- 启动活动 run，写 WorkflowRun / WorkflowStep。
- 运行 simulation，生成 Review 与报告输入。

Service：

- `ActivityManagementService`
- `ActivityRuleService`
- `ExecutionPathPlanner`
- `ActivitySimulationService`
- `DataAvailabilityEvaluator`

Repository：

- `ActivityRepository`
- `ActivityRuleSetRepository`
- `ActivitySimulationRepository`
- `ConnectorRepository`
- `WorkflowRepository`

验收：

- 活动详情页能展示规则摘要、待确认项、相关运行。
- 执行路径接口返回 6 步状态，状态来自 Workflow/AgentRun，不是前端硬编码。
- 规则歧义、字段映射不确定、数据过期进入 Review。

### 3.4 任务与运行

接口：

- `GET /api/agent/missions`
- `POST /api/agent/missions`
- `GET /api/agent/missions/{missionId}`
- `POST /api/agent/missions/{missionId}/runs`
- `GET /api/agent/runs/{runId}`
- `GET /api/agent/runs/{runId}/events?after={sequence}`
- `GET /api/agent/runs/{runId}/events?after={sequence}&stream=1`
- `POST /api/agent/runs/{runId}/pause`
- `POST /api/agent/runs/{runId}/cancel`
- `POST /api/agent/runs/{runId}/questions`
- `POST /api/agent/review-gates/{gateId}/decision`

后端能力：

- Mission 列表、详情、当前 run 聚合。
- Run 详情：阶段、步骤、工具调用、异常、Review Gate。
- 持久化 EventStore，支持断线重放。
- 真 SSE 持续推送，不只返回已有事件。
- Run 内问答只基于当前 run evidence、rules、tool calls 回答。
- Pause/cancel 只影响 Agent run，不撤销已落库业务结论。

Service：

- `AgentMissionService`
- `AgentMissionQueryService`
- `AgentRunService`
- `AgentEventStore`
- `AgentToolExecutor`
- `RunQuestionService`

Repository：

- `AgentSessionRepository`
- `AgentMissionRepository`
- `AgentRunRepository`
- `AgentMessageRepository`
- `AgentRunEventRepository`
- `AgentToolCallRepository`
- `AgentReviewGateRepository`
- `WorkflowRepository`

验收：

- 刷新页面后 run 状态可恢复。
- `events?after=n` 只返回缺失事件。
- SSE 能收到新增 tool/review/status 事件。
- 危险工具继续 fail-closed。

### 3.5 Review工作台

接口：

- `GET /api/reviews`
- `GET /api/reviews/{reviewItemId}`
- `POST /api/reviews`
- `POST /api/reviews/{reviewItemId}/decision`
- `PATCH /api/reviews/{reviewItemId}`

后端能力：

- Review 列表支持 tab、类型、风险、状态、负责人、到期时间、搜索。
- Review 详情返回建议、风险、证据、相关规则、相关 run、审批历史。
- 决策记录状态、决策人、备注、修改内容。
- 批准不直接执行高风险业务动作；只推进 Workflow/Agent continuation 或写建议。

Service：

- `ReviewWorkbenchService`
- `ReviewService`
- `ReviewRecommendationBuilder`

Repository：

- `ReviewRepository`
- `ActivityRuleSetRepository`
- `AgentRunRepository`
- `WorkflowRepository`

验收：

- 列表和详情同源，不出现点击后信息对不上。
- 决策后列表状态立即可由 API 重新读取。
- 审批历史可追溯。

### 3.6 报告中心

接口：

- `GET /api/reports`
- `POST /api/reports`
- `GET /api/reports/{reportId}`
- `GET /api/reports/{reportId}/versions`
- `GET /api/reports/{reportId}/versions/{versionId}`
- `POST /api/reports/{reportId}/export`
- `POST /api/reports/{reportId}/subscriptions`

后端能力：

- 报告列表和版本。
- 报告详情 tabs：摘要、任务明细、规则明细、证据详情、修复记录。
- 导出任务：PDF / Excel / PPT，P0 可先返回 `PENDING` 导出 job。
- 订阅设置，P0 可先保存配置，不发邮件。

Service：

- `ReportCenterService`
- `ReportService`
- `ReportSectionAssembler`
- `ExportJobService`

Repository：

- `ReportRepository`
- `ReportVersionRepository`
- `ActivitySimulationRepository`
- `ReviewRepository`
- `WorkflowRepository`

验收：

- 报告不重新生成业务结论，只聚合 simulation/review/evidence。
- 版本切换返回稳定历史 snapshot。
- 导出接口幂等。

### 3.7 数据源

接口：

- `GET /api/connectors`
- `POST /api/connectors`
- `GET /api/connectors/{connectorId}`
- `PATCH /api/connectors/{connectorId}`
- `POST /api/connectors/{connectorId}/sync-runs`
- `GET /api/connectors/{connectorId}/sync-runs`
- `GET /api/connector-runs/{connectorRunId}`
- `POST /api/connectors/browser/page-detection`
- `POST /api/connectors/browser/scan-preview`
- `POST /api/ingest`

后端能力：

- 管理连接器配置摘要、权限摘要、状态。
- 保存采集运行、采集行数、质量分、告警。
- 插件页面识别和扫描预览。
- ingest 继续是服务端唯一入库入口。

Service：

- `ConnectorManagementService`
- `BrowserConnectorService`
- `IngestService`
- `DataQualityService`

Repository：

- `ConnectorRepository`
- `ConnectorRunRepository`
- `SkuSnapshotRepository`
- `WorkflowRepository`

验收：

- 插件侧边栏 scan preview 不写业务真相。
- `发送到 Agent` 后通过 `POST /api/ingest` 进入 SKU 档案。
- 不读取、不复制、不保存 cookie/token。

### 3.8 规则库

接口：

- `GET /api/rule-sets`
- `POST /api/rule-sets`
- `GET /api/rule-sets/{ruleSetId}`
- `PATCH /api/rule-sets/{ruleSetId}`
- `POST /api/rule-sets/{ruleSetId}/versions`
- `GET /api/rule-sets/{ruleSetId}/versions`
- `POST /api/rule-sets/{ruleSetId}/enable`
- `POST /api/rule-sets/{ruleSetId}/disable`

后端能力：

- 规则集列表、详情、版本、启停。
- 规则 DSL 预览。
- 影响字段和关联数据源。
- 人工确认项。
- 相关运行。

Service：

- `RuleSetService`
- `ActivityRuleService`
- `RequiredFieldExtractor`

Repository：

- `RuleSetRepository`
- `RuleSetVersionRepository`
- `ActivityRuleSetRepository`
- `AgentRunRepository`

验收：

- 规则版本可回看。
- 启停不影响历史 run。
- 规则 DSL 必须 Zod 校验。

### 3.9 设置

接口：

- `GET /api/settings/workspace`
- `PATCH /api/settings/workspace`
- `GET /api/settings/tool-policy`
- `PATCH /api/settings/tool-policy`
- `GET /api/settings/users`

后端能力：

- 工作区阈值：数据 freshness、Review SLA。
- Agent tool allowlist / denylist。
- 用户和角色列表，P0 可先静态返回。

Service：

- `WorkspaceSettingsService`
- `ToolPolicyService`

Repository：

- `WorkspaceSettingRepository`
- `UserRepository` 或静态 config adapter

验收：

- 生产模式不允许启用 dev auth fallback。
- 修改 tool policy 后危险工具仍强制 deny。

## 4. 分工建议

### Workstream A：Contracts & API Shell

负责人类型：后端契约工程师

范围：

- 把 `docs/frontend-redesign-api-contract.md` 转成 `apps/contracts/types` DTO。
- 为新增接口补 OpenAPI。
- 统一 `ApiEnvelope`、分页、错误码、query DTO。
- 补 `TraceableRef`、`EvidenceRef`、状态枚举。

依赖：无。

交付：

- `apps/contracts/types/frontendRedesign.ts`
- `apps/contracts/openapi/*.yaml`
- `apps/contracts/errors/*.md` 或错误码清单

验收：

- TypeScript typecheck 通过。
- 每个前端菜单至少有对应 DTO。

### Workstream B：Persistence & Repository Foundation

负责人类型：后端数据工程师

范围：

- 修复 Prisma client 接入，禁止生产静默回退 memory。
- 接入 route auth boundary。
- 补 repository implementation。
- 评估并新增 P0 表：Activity、ConnectorRun、Report/ReportVersion、RuleSetVersion、WorkspaceSetting。

依赖：A 的核心 DTO 可以并行，DB 字段需与 C/D/E/F/G 对齐。

交付：

- Prisma migration。
- Repository 接口与 Prisma 实现。
- 生产 adapter smoke。

验收：

- `PICKAGENT_PERSISTENCE_ADAPTER=prisma` 时不能静默 memory。
- ingest/profile/snapshot/diagnosis/projection 真实事务测试通过。
- route 缺 actor/tenant/session 时生产模式拒绝。

风险：`L3`，执行 migration 前需要确认。

### Workstream C：SKU & Dashboard Read Models

负责人类型：后端业务读模型工程师

范围：

- `WorkbenchShellService`
- `DashboardOverviewService`
- `SkuReadinessQueryService`
- `ReadinessChecklistBuilder`
- `EvidenceRefBuilder` 第一版

依赖：A；B 的 Prisma 可先用 memory adapter 并行。

交付接口：

- `GET /api/workbench/shell`
- `GET /api/dashboard/overview`
- `GET /api/skus`
- `GET /api/skus/{skuProfileId}`
- `POST /api/skus/bulk-review-items`

验收：

- 原型 SKU 列表和详情抽屉首屏单接口可渲染。
- 每条 checklist 有 evidence refs。
- Dashboard KPI 与 SKU list 统计一致。

### Workstream D：Activity & Rule Execution

负责人类型：后端规则/活动工程师

范围：

- `ActivityManagementService`
- `ExecutionPathPlanner`
- `RequiredFieldExtractor`
- `DataAvailabilityEvaluator`
- simulation route 与 activity route 对齐

依赖：A；部分依赖 B 的 Activity 表。

交付接口：

- `GET /api/activities`
- `POST /api/activities`
- `GET /api/activities/{activityId}`
- `PATCH /api/activities/{activityId}`
- `POST /api/activities/{activityId}/rule-sets/parse`
- `GET /api/activities/{activityId}/execution-plan`
- `POST /api/activities/{activityId}/runs`
- `POST /api/activities/{activityId}/simulations`

验收：

- 活动规则执行路径 6 步可由 API 渲染。
- 缺失字段、过期数据、映射歧义进入 pending confirmations。
- simulation result 不污染长期 health status。

### Workstream E：Agent Mission / Run Runtime

负责人类型：Agent 后端工程师

范围：

- 持久化 `AgentEventStore`
- `AgentRunService`
- `AgentMissionQueryService`
- SSE live stream
- pause/cancel
- run 内问答
- Review Gate continuation

依赖：A、B；工具调用依赖 C/D/F/G 对应 service。

交付接口：

- `GET /api/agent/missions`
- `POST /api/agent/missions`
- `GET /api/agent/missions/{missionId}`
- `POST /api/agent/missions/{missionId}/runs`
- `GET /api/agent/runs/{runId}`
- `GET /api/agent/runs/{runId}/events`
- `POST /api/agent/runs/{runId}/pause`
- `POST /api/agent/runs/{runId}/cancel`
- `POST /api/agent/runs/{runId}/questions`
- `POST /api/agent/review-gates/{gateId}/decision`

验收：

- 重启后 event replay 可恢复。
- SSE 能持续收到新事件。
- `createReviewItems` 仍必须先走 Review Gate。
- dangerous tools fail-closed。

风险：真实 Pi/model 接入为 `L3`，本 workstream P0 可先完成持久 EventStore 和最小 adapter。

### Workstream F：Review & Reports

负责人类型：审批/报告工程师

范围：

- `ReviewWorkbenchService`
- `ReviewRecommendationBuilder`
- `ReportCenterService`
- `ReportSectionAssembler`
- report versions/export/subscription shell

依赖：A；报告依赖 D simulation 和 C evidence。

交付接口：

- `GET /api/reviews`
- `GET /api/reviews/{reviewItemId}`
- `POST /api/reviews`
- `POST /api/reviews/{reviewItemId}/decision`
- `PATCH /api/reviews/{reviewItemId}`
- `GET /api/reports`
- `POST /api/reports`
- `GET /api/reports/{reportId}`
- `GET /api/reports/{reportId}/versions`
- `POST /api/reports/{reportId}/export`
- `POST /api/reports/{reportId}/subscriptions`

验收：

- Review 详情抽屉完整展示建议、风险、证据、相关规则、相关 Run。
- 审批历史可追溯。
- 报告摘要、风险、修复建议、Review 结果来自后端稳定 snapshot。

### Workstream G：Connectors & Browser Plugin Backend

负责人类型：连接器/插件后端工程师

范围：

- `ConnectorManagementService`
- `BrowserConnectorService`
- `ConnectorRunRepository`
- scan preview
- connector sync run
- ingest 与 connector run 关联

依赖：A；B 的 ConnectorRun 表建议先定。

交付接口：

- `GET /api/connectors`
- `POST /api/connectors`
- `GET /api/connectors/{connectorId}`
- `PATCH /api/connectors/{connectorId}`
- `POST /api/connectors/{connectorId}/sync-runs`
- `GET /api/connectors/{connectorId}/sync-runs`
- `GET /api/connector-runs/{connectorRunId}`
- `POST /api/connectors/browser/page-detection`
- `POST /api/connectors/browser/scan-preview`

验收：

- 数据源页面和插件侧边栏都能由 API 渲染。
- scan preview 不入库业务结论。
- ingest 成功后 ConnectorRun 可追溯。

### Workstream H：Rule Library & Settings

负责人类型：规则平台/配置工程师

范围：

- `RuleSetService`
- `RuleSetVersionRepository`
- `WorkspaceSettingsService`
- `ToolPolicyService`

依赖：A、B。

交付接口：

- `GET /api/rule-sets`
- `POST /api/rule-sets`
- `GET /api/rule-sets/{ruleSetId}`
- `PATCH /api/rule-sets/{ruleSetId}`
- `POST /api/rule-sets/{ruleSetId}/versions`
- `GET /api/rule-sets/{ruleSetId}/versions`
- `POST /api/rule-sets/{ruleSetId}/enable`
- `POST /api/rule-sets/{ruleSetId}/disable`
- `GET /api/settings/workspace`
- `PATCH /api/settings/workspace`
- `GET /api/settings/tool-policy`
- `PATCH /api/settings/tool-policy`
- `GET /api/settings/users`

验收：

- 规则库列表和右侧详情可渲染。
- 版本、启停、关联运行可查。
- 工具策略更新不允许放开 L3 runtime tools。

## 5. 推荐实施顺序

### Phase 0：契约冻结

Owner：A

内容：

- 定 DTO。
- 定 OpenAPI。
- 定错误码。
- 定菜单到接口清单。

完成标准：

- 前后端都只围绕同一 contract 开发。

### Phase 1：生产化基础修正

Owner：B

内容：

- 修 Prisma client 接入。
- route 显式 auth context。
- 禁止生产静默 memory。
- 最小 repository transaction smoke。

完成标准：

- 后续 workstream 不再基于不可恢复内存状态做“生产完成”声明。

### Phase 2：前端首屏可用 API

Owner：C、D、F、G、H 并行

内容：

- 概览、SKU、活动路径、Review、报告、数据源、规则库首屏接口。

完成标准：

- 每个一级菜单首屏只依赖 1-2 个后端 DTO。
- 前端不重算业务结论。

### Phase 3：任务与运行闭环

Owner：E

内容：

- 持久 EventStore。
- Run detail。
- SSE。
- Review Gate continuation。
- Run 内问答。

完成标准：

- Agent Mission 页面刷新可恢复，事件可重放。

### Phase 4：深层交互与导出

Owner：F、G、H

内容：

- 报告版本/导出/订阅。
- 连接器运行详情。
- 规则版本管理。
- 设置页。

完成标准：

- 原型中右侧抽屉、tabs、版本、导出按钮都有后端对应能力。

## 6. 并行依赖图

```text
A Contracts
  ├── C Dashboard/SKU
  ├── D Activity/Execution Path
  ├── F Review/Reports
  ├── G Connectors
  └── H Rule Library/Settings

B Persistence/Auth Foundation
  ├── C/D/F/G/H production adapters
  └── E Agent persistent EventStore

C + D + F + G + H services
  └── E Agent tools consume business services
```

## 7. 最小验收矩阵

| 菜单 | 验收接口 | 必须验证 |
|---|---|---|
| 概览 | `GET /api/dashboard/overview` | KPI 与列表统计一致 |
| SKU列表 | `GET /api/skus`, `GET /api/skus/:id` | 详情 checklist 带 evidence |
| 活动管理 | `GET /api/activities/:id/execution-plan` | 6 步执行路径与 pending confirmations |
| 任务与运行 | `GET /api/agent/runs/:id`, events SSE | 刷新恢复、断线重放 |
| Review工作台 | `GET /api/reviews/:id`, decision | 决策持久化与审批历史 |
| 报告中心 | `GET /api/reports/:id` | 版本稳定、证据可追溯 |
| 数据源 | `GET /api/connectors`, scan preview | preview 不写业务真相 |
| 规则库 | `GET /api/rule-sets/:id` | DSL、影响字段、相关运行 |
| 设置 | `GET /api/settings/tool-policy` | 危险工具 deny |

## 8. 当前后端缺口优先级

P0 必须补：

- Prisma adapter 不得静默降级 memory。
- Route auth/tenant boundary 显式接入。
- Health status contract 改为 `READY/REPAIRABLE/RISKY/BLOCKED`。
- `EvidenceRef` 字段级结构。
- `Activity` 主对象。
- `AgentEventStore` 持久化与 live SSE。
- Review detail API。
- Dashboard/Shell 聚合 API。

P1 可后置：

- Report PDF/Excel/PPT 真实文件生成。
- Connector 真实平台调度。
- RuleSet 独立版本表的完整 diff/rollback。
- Run 内问答接真实模型。
- EvidenceRef 独立表。

P2 可后置：

- 真实 ERP/API 深度集成。
- 自动报名、改价、修改商品详情页。
- 多 workspace 完整权限系统。

## 9. 推荐任务切片

1. `backend-contracts-for-redesign`
   - 输出 DTO、OpenAPI、错误码。
   - 中文需求：为新版前端九个一级菜单冻结后端契约。

2. `p0-prisma-auth-foundation`
   - 修 Prisma client、auth boundary、禁止 silent memory fallback。
   - 中文需求：让生产 API 具备真实持久化和租户边界。

3. `dashboard-sku-readiness-api`
   - Shell、Dashboard、SKU list/detail、bulk review。
   - 中文需求：支撑概览和 SKU 准入工作台首屏与详情抽屉。

4. `activity-execution-path-api`
   - Activity、rule parse、execution plan、simulation。
   - 中文需求：支撑活动管理中的规则执行路径与准入模拟。

5. `agent-run-eventstore-api`
   - Mission list/detail、Run detail、persistent events、SSE、review gate。
   - 中文需求：支撑任务与运行的聊天式任务控制台和运行监控。

6. `review-report-center-api`
   - Review detail/decision/history、Report list/detail/version/export shell。
   - 中文需求：支撑 Review 工作台和报告中心。

7. `connector-browser-api`
   - Connector list/detail/run、browser page detection、scan preview、ingest relation。
   - 中文需求：支撑数据源连接器和浏览器插件采集面板。

8. `rules-settings-api`
   - RuleSet list/detail/version/enable/disable、workspace/tool policy settings。
   - 中文需求：支撑规则库和设置。

## 10. Definition of Done

单个切片完成必须满足：

- Contract 类型与 route 实现一致。
- route handler 只做 parse/auth/service/envelope。
- service 有单测或 integration smoke。
- 关键写操作有 Workflow/Agent/Review 审计。
- 返回 DTO 能直接驱动对应原型页面。
- Evidence/TraceableRef 不为空按钮。
- `scripts/typecheck backend` 通过。
- 涉及 frontend route 时 `scripts/typecheck frontend` 通过。
