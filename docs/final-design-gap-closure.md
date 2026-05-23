# Final Design Gap Closure

日期：2026-05-23

本文把当前 Layer 3 结果和最终设计目标之间的缺口整理成可执行设计。它不声明实现已完成，只定义下一层联调和生产化应如何收口。

关联文档：

- `docs/architecture.md`
- `docs/pi-agent-copilot-design.md`
- `docs/agent-backend-data-architecture.md`
- `openspec/changes/cross-module-integration-and-acceptance/`
- `docs/operations/pickagent-layer2-todos.md`
- `docs/operations/pickagent-ui-e2e-review-2026-05-23.md`

## 1. 当前基线

Layer 3 已经完成的能力属于“可演示集成层”：

- 插件已有抖店库存接口 adapter、脱敏 fixture 和 ingest payload 提交通路。
- 员工工作台已有 Dashboard、Connectors、SKU Health、Activities、Reviews、Reports 页面。
- 后端业务基座已有内存 runtime 下的 ingest、projection、rule parse、simulation、review、report、AgentToolRegistry。
- Prisma schema 已包含 SKU、活动、Review、Workflow 和 Agent Copilot 相关表。
- Agent Copilot 已证明 fake runtime adapter 可以消费 `AgentToolRegistry`，并禁用 `coding`、`file`、`bash`。

这些能力可以继续进入统一联调，但不能等同于最终闭环。最终闭环仍需要真实 API route、repository / transaction、Agent SSE、Pi runtime、Copilot Overlay、真实页面验证和可视化验收证据。

## 2. 最终目标判定

最终设计完成不是“页面能打开”，而是满足以下五条：

1. 插件采集事实可以进入服务端 ingest，并产生 `SkuProfile`、`SkuSnapshot`、`SkuHealthDiagnosis`、`CurrentSkuProjection`。
2. 员工工作台所有页面都消费真实 API DTO，mock 只作为开发 fallback，不作为默认生产数据源。
3. 活动规则、模拟、Review、报告共用同一组 application service 和持久化数据，不在前端或 Chat 中重算业务结论。
4. Agent Copilot 作为所有工作台的常驻 Overlay，通过 `WorkbenchContext`、SSE、`AgentToolRegistry` 和 Review Gate 推进任务。
5. 所有高风险或不可确定动作都有 evidence、tool trace、WorkflowStep、ReviewItem 或 AgentReviewGate 可追溯。
6. 首屏 DTO 在 SSR 和客户端 hydration 之间保持稳定，UI E2E 不允许出现 React hydration mismatch、空按钮或只能读不能追溯的 evidence 行。

## 3. 收敛分层

### L4：统一联调层

目标：把 Layer 3 的模块按固定顺序连起来，找出真实阻塞。

L4 必须完成：

- 绑定最小真实 API route，至少覆盖健康 summary/list/detail、ingest、活动 parse/simulation、review decision、report preview、agent mission/run/events。
- 用同一 seed 或 fixture 贯通插件采集结果到员工工作台状态展示。
- 用同一 rule set 和 SKU projection 贯通活动模拟到 Review 和报告。
- 用 Agent fake runtime 或最小 Pi adapter 贯通 Agent tool trace 到业务 service。
- 输出中文验收结论，标明每条链路“通过 / 非阻塞风险 / 阻塞”。

L4 不必须完成：

- 完整权限系统。
- 真实 ERP / 平台生产 API 深度接入。
- 自动改价、自动报名、自动修改商品详情页。
- 多 Agent mesh。

### P0：生产化最小层

目标：让系统可以用真实 PostgreSQL、真实 API 和可恢复 Agent run 承接 MVP 级演示。

P0 必须完成：

- Prisma repository / transaction 接线。
- API route 绑定到 application service。
- `AgentEventStore` 和 SSE 断线重放。
- `AgentRun` 关联 `WorkflowRun`，重要 tool call 关联 `WorkflowStep`。
- `AgentReviewGate` 可创建或关联正式 `ReviewItem`。
- Copilot Overlay 挂到人工工作台 layout，而不是只保留单独 `/agent-chat` 页面。
- Pi runtime 至少通过 adapter 执行 3 个低风险业务工具。

### P1：扩展生产层

目标：补齐更完整的平台数据源、调度、审计和配置能力。

P1 可以后置：

- 真实 sale price 来源、类目字典、状态码字典自动归一化。
- 工具注册后台配置化。
- EvidenceRef 独立表。
- 外部事件触发 Agent mission。
- 周期巡检、定时报告和多 workspace 权限。

## 4. 主缺口设计

### 4.1 API 和持久化缺口

当前状态：

- Prisma schema 和迁移已有。
- CRUD controller / route 多数仍是骨架。
- 业务主链路主要通过内存 `BusinessFoundationStore` 验证。

最终设计：

```text
HTTP Route
  -> Controller
  -> Application Service
  -> Repository
  -> Prisma transaction
  -> PostgreSQL
```

最小 route 绑定顺序：

1. `POST /api/ingest`
2. `GET /api/health/summary`
3. `GET /api/skus`
4. `GET /api/skus/:skuProfileId`
5. `POST /api/activities/parse`
6. `POST /api/activities/:activityRuleSetId/simulations`
7. `GET /api/reviews`
8. `POST /api/reviews/:reviewItemId/decision`
9. `POST /api/reports`
10. `POST /api/agent/missions`
11. `POST /api/agent/missions/:missionId/runs`
12. `GET /api/agent/runs/:runId/events?after=<sequence>`
13. `POST /api/agent/review-gates/:gateId/decision`

Repository 设计要求：

- `IngestService.ingest()` 必须在一个事务里完成 profile upsert、snapshot insert、diagnosis insert、projection upsert、workflow audit。
- `ActivitySimulationService.runSimulation()` 必须持久化 `ActivitySimulationRun` 和每个 `ActivitySimulationResult`。
- `ReviewService.decide()` 必须只更新 Review 决策状态，不反向改写活动模拟或长期健康结论。
- `ReportService.generatePreview()` 可先只持久化 preview metadata 和 evidence summary，正式文件导出继续后置。
- Agent 相关写入通过 `AgentRunService`、`AgentEventStore`、`AgentToolExecutor` 统一落库，不允许 Pi adapter 直接访问 Prisma client。

### 4.2 Agent Copilot 缺口

当前状态：

- `/agent-chat` 是单独页面。
- fake runtime adapter 可以输出 Mission、Run、Plan、Trace、Evidence、Gate。
- 没有真实 Pi event stream，没有工作台级 Overlay。

最终设计：

```text
Console Layout
  -> AgentCopilotProvider
  -> FloatingBubble
  -> SidecarPanel
  -> CompareMode
  -> useWorkbenchContext()
  -> useAgentRunEvents()
```

实施顺序：

1. 把当前 `/agent-chat` 页面拆成 `agent-copilot` 模块组件。
2. 在 `apps/frontend/src/app/(console)/layout.tsx` 注入 `AgentCopilotProvider`。
3. 每个工作台页面提供 `WorkbenchContext`，至少包含 route、pageTitle、selectedEntity、visibleFilters。
4. Sidecar Panel 复用现有 Messages、Plan、Trace、Linked Context、Evidence、Review Gate 视图。
5. `useAgentRunEvents(runId)` 消费 SSE，把 `assistant_delta` 写入 Chat，把 `tool` 写入 Trace，把 `review_gate` 打开 Gate 区域，把 `context_link` 关联左侧对象。
6. Compare Mode 只做对照和跳转，不在侧边栏内重新计算 SKU 健康或活动准入。

Copilot 不再新增私有业务工具。所有工具必须经过 `AgentToolRegistry`。

### 4.3 Pi runtime 缺口

当前状态：

- fake adapter 是正确边界，但不是真实 runtime。
- 当前 adapter 同步返回整包 run，没有 `AsyncIterable<AgentRunEvent>`。

最终设计：

```text
AgentRunService
  -> AgentContextAssembler
  -> PiAgentLoopAdapter
  -> VercelAiModelAdapter
  -> AgentToolRegistry
  -> AgentToolExecutor
  -> Application Services
```

P0 默认策略：

- Review Gate 决策后启动 continuation run，不强行恢复同一个 Pi run。
- Pi session 只存 `piSessionKey` / `piSessionRef`，不存 token、cookie 或模型密钥。
- 禁用 Pi 默认 `coding`、`file`、`bash`、direct SQL、credential access。
- L2 工具调用前必须先经过 `ReviewGatePolicy`。
- 每个 adapter event 都写入 `AgentRunEvent` 后再推给 SSE。

最小真实 Pi POC 只开放 3 个工具：

- `parseActivityRules`
- `simulateActivityReadiness`
- `explainDecisionWithEvidence`

现有 fake adapter 可继续保留为测试 fallback，但生产路径不能依赖它。

### 4.4 Tool Registry 缺口

当前状态：

- 已有 5 个工具：`getSkuSummary`、`parseActivityRules`、`runSimulation`、`createReviewItems`、`generateReportPreview`。
- 工具 definition 还缺最终设计中的 permission、riskLevel、reviewPolicy、evidencePolicy。

最终 P0 工具定义：

| Tool | 当前状态 | 目标 service | 风险 | Review 策略 |
|---|---|---|---:|---|
| `parseActivityRules` | 已有，需改名或兼容 | `ActivityRuleService` | L1 | none |
| `simulateActivityReadiness` | 已有 `runSimulation`，需对齐命名 | `ActivitySimulationService` | L1 | none |
| `explainDecisionWithEvidence` | 缺失 | `ReportService` / `EvidenceBuilder` | L0 | none |
| `checkDataFreshness` | 缺失 | `SkuQueryService` | L0 | none |
| `diagnoseSkuHealth` | 缺失 | `HealthAssessmentService` | L1 | none |
| `createReviewItems` | 已有，需补 policy | `ReviewService` | L2 | required_before_execute |
| `generateActivityReport` | 已有 `generateReportPreview`，需对齐命名 | `ReportService` | L1 | none |
| `extractExecutionRequirements` | 缺失 | `ExecutionPathPlanner` | L1 | none |
| `generateExecutionChecklist` | 缺失 | `ExecutionPathPlanner` | L1 | none |
| `requestConnectorIngest` | 缺失 | `IngestService` / connector gateway | L1 | required_after_suggestion |

工具执行统一返回：

```ts
interface AgentToolExecution {
  toolCallId: string;
  toolName: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED_BY_POLICY" | "WAITING_FOR_APPROVAL";
  permission: "read" | "simulate" | "create_review" | "generate_report";
  riskLevel: "L0" | "L1" | "L2";
  reviewPolicy: "none" | "required_before_execute" | "required_after_suggestion";
  linkedEntityRefs: LinkedEntityRef[];
  evidenceRefs: EvidenceRef[];
  traceSummary: string[];
}
```

### 4.5 Evidence 缺口

当前状态：

- DTO 里的 evidence 多为 `{ type, entityId, label, summary }`。
- 最终设计要求 evidence 能定位字段和规则。

P0 evidence ref 必须补齐：

```ts
interface EvidenceRef {
  sourceType: "sku_snapshot" | "rule_set" | "simulation_result" | "review_item" | "workflow_step" | "agent_tool_call";
  sourceId: string;
  field?: string;
  rawValue?: unknown;
  normalizedValue?: unknown;
  ruleId?: string;
  evidenceText?: string;
  collectedAt?: string;
}
```

设计要求：

- 业务 service 可以先在 JSON 字段中保存 `EvidenceRef[]`，P1 再拆独立表。
- Agent context 默认只塞 evidence 摘要，不塞完整 `rawJson`。
- 前端展示 evidence 时必须能跳到来源对象或至少显示来源类型、来源 ID、字段、采集时间。
- 报告不重新生成业务结论，只聚合 service 返回的 evidence summary。

### 4.6 插件真实采集缺口

当前状态：

- 已验证抖店库存主接口脱敏 fixture。
- 价格字段和类目名称缺失。
- 分页、筛选、状态字典、诊断批量限制仍需真实页面验证。

最终设计的采集证据矩阵：

| 证据 | 目的 | 阻塞级别 |
|---|---|---:|
| 库存列表第一页 fixture | 证明字段映射可用 | L4 必须 |
| 翻页 fixture | 证明 page / pageSize / page_size 行为 | L4 必须 |
| 筛选 fixture | 证明筛选参数不会丢字段 | P0 必须 |
| 状态码对照截图或录屏 | 解释 status / check_status / stock_type | P0 必须 |
| 价格来源接口 fixture | 补 sale price / campaign price | P0 阻塞活动价格规则 |
| 类目字典或商品详情 fixture | 补类目名称 | P0 非阻塞，P1 可完善 |
| sku_stock_diagnose 批量 fixture | 确认批量上限和频率 | P0 必须 |

插件边界保持不变：

- 不读取、不复制、不保存 Cookie/token。
- 不自动修改平台后台数据。
- 只展示采集事实和采集层风险。
- 业务健康、准入、Review、报告结论全部交给服务端和员工工作台。

### 4.7 UI E2E 新缺口的设计解法

2026-05-23 UI E2E 验收暴露了三个设计缺口：`Reports` hydration mismatch、证据链 / Review Gate 不可点击追溯、Review 决策只在页面内临时生效。解决方案必须进入设计基线，不能只作为测试备注。

#### 4.7.1 稳定 SSR / Client Snapshot

问题：

- `ReportsPage` 在 client component 内通过 `useState(() => createReportProviderSnapshot())` 创建业务快照。
- provider 会即时创建 `BusinessFoundationRuntime` 并调用 `ReportService.generatePreview()`。
- `ReportService.generatePreview()` 依赖模块级 sequence 生成 report id。
- SSR 和客户端 hydration 重算时 report id 可能不同，导致 React hydration mismatch。

设计解法：

```text
Server Route / Server Component
  -> 读取或创建稳定 ReportPreview
  -> 序列化 initialSnapshot
  -> Client Component 只接收 props 并处理交互状态
```

约束：

- Client component 不得在 render / hydration 初始化阶段创建业务 runtime、调用会分配 ID 的 service，或生成首屏业务 DTO。
- `ReportPreview` 的 `reportId`、`generatedAt`、`sections` 和 `evidenceSummary` 必须来自稳定 snapshot。
- 开发 fallback 也必须使用确定性 fixture id，不能使用全局递增 sequence 作为首屏展示 ID。
- 生产路径建议拆成：
  - `POST /api/reports/previews`：创建报告预览，返回稳定 `reportId`。
  - `GET /api/reports/:reportId`：读取稳定报告预览。
  - `/reports`：默认读取最近 preview 或 seed preview，不在客户端即时生成。
- UI E2E 必须断言生产模式没有 React page error / hydration mismatch。

#### 4.7.2 TraceableRef 统一追溯模型

问题：

- `Activities` 的 `MANUAL_REVIEW` 结果只展示 Review 来源，没有进入 Review 工作台或具体 Review item 的入口。
- `Agent Chat` Gate 批准后 next action 只是文本，没有链接到 Review Gate、Review 工作台或 run trace。
- `Reports` 的 Evidence Summary 是静态行，不能跳到 evidence source / run / rule。
- `Reviews` 的“对象入口”是空按钮，点击后没有导航、抽屉或详情展开。

设计解法：

所有 evidence、source object、review gate、tool trace 和 report section 都统一携带 `TraceableRef`：

```ts
interface TraceableRef {
  entityType:
    | "sku_profile"
    | "sku_snapshot"
    | "activity_rule_set"
    | "activity_simulation_run"
    | "activity_simulation_result"
    | "review_item"
    | "agent_review_gate"
    | "agent_run"
    | "agent_tool_call"
    | "workflow_step"
    | "report";
  entityId: string;
  label: string;
  href?: string;
  drawerTarget?: {
    route: string;
    panel: "evidence" | "source" | "trace" | "review_gate";
  };
  field?: string;
  collectedAt?: string;
}
```

路由 / 抽屉映射：

| Entity | P0 目标入口 |
|---|---|
| `sku_profile` | `/sku-health/:skuProfileId` |
| `activity_rule_set` | `/activities?ruleSetId=...` 或规则抽屉 |
| `activity_simulation_run` | `/activities?simulationRunId=...` 或模拟结果抽屉 |
| `activity_simulation_result` | `/activities?simulationResultId=...` |
| `review_item` | `/reviews?reviewId=...` |
| `agent_review_gate` | `/agent-runs/:runId?gateId=...` 或 Copilot Gate 抽屉 |
| `agent_run` | `/agent-runs/:runId` 或 Workflows run 详情 |
| `agent_tool_call` | `/agent-runs/:runId?toolCallId=...` |
| `workflow_step` | `/workflows/:workflowRunId?stepId=...` |
| `report` | `/reports/:reportId` |

前端组件约束：

- `EvidenceRow` 默认渲染为可点击 `EvidenceLink`；确实没有 `href` 时必须打开只读 drawer，不能只是静态文本。
- `SourceObjectLink` 取代空的“对象入口”按钮。
- `ReviewGatePanel` 的 Approve / Reject / Modify 后必须提供可点击的 Gate、ReviewItem、Run Trace 入口。
- `ReportSection` 的每条 evidence summary 必须能定位 `TraceableRef`。
- Activities 中任何 `MANUAL_REVIEW` 结果必须能创建或定位 `ReviewItem`，并给出 `/reviews?reviewId=...`。

#### 4.7.3 Review 决策持久化和跨页面联动

问题：

- `/reviews` 批准后当前页面能显示反馈，但刷新后状态恢复为 provider 初始快照。
- Reports 和 Agent next action 没有消费同一个 Review decision 状态。

设计解法：

```text
POST /api/reviews/:reviewItemId/decision
  -> ReviewService.decide()
  -> ReviewRepository.updateStatus()
  -> ReviewDecisionAudit append
  -> AgentRunEvent / WorkflowStep append if linked
  -> query invalidation / SSE event
```

约束：

- 前端可以 optimistic update，但必须随后重新读取服务端 Review DTO。
- `ReviewService.decide()` 只能更新 Review 决策状态和审计事件，不反向改写长期健康结论或活动模拟结论。
- `AgentReviewGate.reviewItemId` 存在时，Review 决策必须同步写入 Gate 状态或生成 continuation run。
- `ReportService.generatePreview()` 读取已持久化 Review decision，用于 unresolved risks 和 next actions。
- 刷新页面后，Review 工作台、Reports、Agent Copilot 看到的状态必须一致。

#### 4.7.4 UI E2E 验收门槛

后续 L4 / P0 UI 验收不能只检查页面 200 或单元测试通过，必须至少覆盖：

- 生产模式打开 `/activities`、`/reviews`、`/agent-chat`、`/reports`、`/sku-health` 没有 React page error。
- `/reports` 没有 hydration mismatch。
- `MANUAL_REVIEW` 模拟结果能跳到 Review 工作台或打开 Review item。
- Review 决策刷新后仍保留。
- Agent Review Gate 决策后能打开 Gate / Review / Run Trace。
- Report evidence summary 每条都能追溯 source。
- 移动端 390px 视口无横向溢出。

## 5. L4 主链路设计

L4 按以下链路验收，不能随机并发：

### 链路 A：插件到 SKU 健康

```text
抖店页面 / fixture
  -> extension preview
  -> POST /api/ingest
  -> IngestService transaction
  -> CurrentSkuProjection
  -> Dashboard / SKU Health
```

通过条件：

- 插件提交 payload 后返回 ingest receipt。
- Dashboard summary 数量变化可解释。
- SKU detail 能看到 snapshot、diagnosis、collection risk 和 evidence。

### 链路 B：活动模拟到 Review / 报告

```text
Activity rule text
  -> ActivityRuleService.parseRules
  -> ActivitySimulationService.runSimulation
  -> ReviewService.createReviewItems
  -> ReportService.generatePreview
```

通过条件：

- Rule DSL 校验通过，低置信或商机线索进入 `manual_review`。
- 模拟结果区分 `DIRECT_READY`、`REPAIRABLE_READY`、`MANUAL_REVIEW`、`BLOCKED`。
- Review 只处理人工决策，不重算模拟。
- Report 展示 unresolved risks 和 evidence summary。

### 链路 C：员工工作台到 Agent Copilot

```text
WorkbenchContext
  -> POST /api/agent/missions
  -> POST /api/agent/missions/:missionId/runs
  -> SSE events
  -> Sidecar Panel
  -> Review Gate decision
```

通过条件：

- 任意主工作台页面都能打开 Copilot Sidecar。
- Agent 能读取当前 selected entity。
- Tool trace 能链接到业务对象和 evidence。
- Review Gate 暂停后，人工决策能触发 continuation run。

### 链路 D：Agent 到真实业务工具

```text
Pi / fake fallback
  -> AgentToolRegistry
  -> AgentToolExecutor
  -> Application Service
  -> WorkflowStep / AgentToolCall / Evidence
```

通过条件：

- 未注册工具被拒绝。
- L2 工具按策略先进入 Review Gate。
- 工具输出经过大小限制和敏感字段过滤。
- `coding`、`file`、`bash` 不出现在业务 Agent 可用工具中。

## 6. 验收等级

| 等级 | 含义 | 可宣告内容 |
|---|---|---|
| L3 complete | 模块级可演示集成完成 | 前置模块“不阻塞 L4” |
| L4 accepted | 主链路联调通过 | 可以做系统级演示 |
| P0 production-ready | 真实 API、数据库、Agent run 可恢复 | 可以交付 MVP 内测 |
| P1 scalable | 外部数据源、调度、权限、报告导出完善 | 可以扩展真实客户试点 |

当前项目只能宣告 L3 complete，不能宣告 L4 accepted 或 P0 production-ready。

## 7. 阻塞判定

以下问题阻塞 L4：

- route 未绑定导致主链路无法通过 HTTP 调用。
- Prisma schema validate 失败或 migration 无法应用。
- ingest 到 projection 无法形成 SKU 当前状态。
- 活动模拟结果无法生成 Review 或报告。
- Agent 工具绕过 `AgentToolRegistry` 或暴露高危默认工具。

以下问题不阻塞 L4，但阻塞 P0：

- 真实 Pi runtime 未接入，但 fake adapter 能证明 contract。
- sale price 来源未补齐，但活动页把价格缺口标为采集风险。
- 类目名称未补齐，但保留 category_id 和采集风险。
- 真实生产 auth 未接入，但 route 有清晰 auth boundary 占位。

以下问题阻塞最终验收：

- 没有截图、录屏或浏览器 smoke 证据。
- 生产 UI E2E 捕获 React page error、hydration mismatch 或不可恢复的客户端错误。
- 无法解释每个 AI 结论的 evidence、rule、run、tool trace 或 review gate 来源。
- evidence、source object、Review Gate 或 Report section 只能展示静态文本，不能打开来源对象、详情抽屉或对应工作台。
- Review 决策只保存在前端内存，刷新后丢失或不能跨 Reports / Agent Copilot 读取。
- 高风险动作可被 Agent 静默执行。
- mock fallback 被误当成生产真实数据。

## 8. 下一步任务切分

建议把 `cross-module-integration-and-acceptance` 拆成 6 个可并行但有顺序依赖的任务：

1. API route binding 和 repository transaction。
2. 插件到 ingest / projection 的 HTTP smoke。
3. 活动模拟到 Review / Report 的持久化 smoke。
4. Agent EventStore + SSE + Sidecar Provider。
5. Pi adapter POC + Tool Registry v2。
6. 稳定 Report snapshot、TraceableRef、Review decision 持久化。
7. 最终 Playwright UI E2E、截图和中文验收报告。

每个任务完成时必须输出：

- 涉及链路。
- 输入 fixture 或操作步骤。
- 通过的命令或浏览器证据。
- 阻塞项归属。
- 是否达到“已完成，不阻塞”。
