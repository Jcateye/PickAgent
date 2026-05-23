# PickAgent 最终设计收敛分工文档

日期：2026-05-23

## 1. 设计评审结论

当前未提交的改进设计方向成立，可以进入 OpenSpec 拆分。

没有发现需要退回重写的架构问题：

- 没有引入 NestJS、Redis、InsForge 或新的后端/runtime 底座。
- 仍保持插件、员工工作台、后端 application service、Agent runtime 的边界。
- Agent Copilot 继续以 Pi 作为 harness / loop，Vercel AI SDK 负责模型与 tool schema，assistant-ui 负责会话 UI。
- mock / fake runtime 被明确降级为 fallback 或 contract 验证工具，没有被声明成最终生产路径。
- L4、P0、P1 的边界清楚，真实 auth、sale price 来源、完整 Pi production runtime、类目字典等没有被错误塞进 L4 必须项。

需要在执行时重点防止四类偏差：

- route binding 只接页面，不落到 repository / transaction。
- Evidence 继续停留在自然语言摘要，不能跳到 source object、rule、run、tool call 或 review gate。
- Review decision 只在页面 state 临时生效，没有成为跨页面共享状态。
- Reports 首屏继续用非确定性 runtime 快照，导致 SSR / hydration 不稳定。

## 2. OpenSpec 拆分规则

本轮不把所有缺口塞回一个总 change。按业务模块拆需求，按依赖层串行推进：

- 一个业务模块对应一个 OpenSpec change 或一个明确的 OpenSpec work package。
- 每个 change 至少包含 `proposal.md`、`specs/<capability>/spec.md`、`design.md`、`tasks.md` 四类内容。
- requirement 用 `MUST / SHALL` 写能力要求，scenario 用 `WHEN / THEN` 写验收行为。
- 同一业务模块内任务串行执行，不能并行抢改同一个模块。
- 同一层内不同业务模块可以并行。
- 下一层必须等上一层所有阻塞项关闭或被标为非阻塞风险后再开始。
- 每个 requirement 完成后独立提交，提交说明用中文写清楚完成的需求。

## 3. 分层总览

| 层级 | 执行方式 | 目标 | 进入下一层条件 |
|---|---|---|---|
| Layer 0：规格冻结层 | 串行 | 把本分工文档转成可执行 OpenSpec change，确认边界和验收模板 | OpenSpec change / worktree / 负责人明确 |
| Layer 4A：后端真实边界层 | 串行 | 先补 route binding、repository / transaction、EventStore 基座 | API、持久化和事件基座可供前端/插件/Agent 消费 |
| Layer 4B：业务模块接线层 | 同层并行 | 插件、员工工作台、活动、Review/报告、Copilot UI 分别接真实边界 | 每个模块可声明“已完成，不阻塞 L4 主链路” |
| Layer 4C：Agent runtime 收敛层 | 串行 | 接 Pi POC、ToolPolicy、ReviewGatePolicy、SSE 断线重放 | Agent 到真实业务工具链路可恢复、可审计 |
| Layer 4D：统一验收层 | 串行 | 按主链路联调、截图/录屏/报告收口 | 输出中文最终验收结论 |
| P0：生产化最小层 | 串行 | 补真实 PostgreSQL、auth boundary、可恢复 run 的内测门槛 | 可宣告 MVP 内测 |

## 4. OpenSpec Change 分配

| 层级 | OpenSpec change 建议名 | 业务模块 | 负责人 | 依赖 | 并行规则 |
|---|---|---|---|---|---|
| Layer 0 | `final-design-work-allocation` | workflow / docs | 协调 Agent | 当前设计文档 | 串行 |
| Layer 4A | `final-api-persistence-foundation` | 后端业务基座 | 后端 Agent | Layer 0 | 串行，优先合并 |
| Layer 4A | `final-agent-eventstore-foundation` | Agent 后端基座 | Agent 后端 Agent | `final-api-persistence-foundation` 的 model / repository 决策 | 可和后端基座后半段协作，但 merge 顺序在其后 |
| Layer 4B | `final-browser-ingest-validation` | 浏览器插件 | 插件 Agent | ingest route 可用 | 与其他 Layer 4B 模块并行 |
| Layer 4B | `final-staff-health-api-closure` | Dashboard / SKU Health | 健康工作台 Agent | health summary/list/detail route 可用 | 与其他 Layer 4B 模块并行 |
| Layer 4B | `final-activity-simulation-closure` | Activities | 活动模拟 Agent | activity parse/simulation route 可用 | 与其他 Layer 4B 模块并行 |
| Layer 4B | `final-review-reporting-closure` | Reviews / Reports | Review 报告 Agent | review/report route 可用；可先用 fixture 等 activity 输出 | 与其他 Layer 4B 模块并行 |
| Layer 4B | `final-copilot-overlay-closure` | Agent Copilot 前端 | Copilot 前端 Agent | Agent mission/run/events route 可用 | 与其他 Layer 4B 模块并行 |
| Layer 4C | `final-pi-tool-policy-poc` | Pi runtime / ToolPolicy | Agent runtime Agent | EventStore、ToolExecutor、Overlay 基本可用 | 串行 |
| Layer 4D | `final-cross-module-acceptance` | 统一联调验收 | 验收 Agent | Layer 4B、Layer 4C 全部不阻塞 | 串行 |

## 5. 需求与任务拆分

### 5.1 `final-api-persistence-foundation`

Requirement: API route binding and transaction foundation

后端 MUST 把 L4 主链路所需 route 绑定到 application service，并 SHALL 通过 repository / transaction 写入或读取稳定数据，而不是继续依赖内存 runtime 作为主路径。

Scenarios:

- WHEN 插件提交 ingest payload，THEN `POST /api/ingest` 在单事务内写入 `SkuProfile`、`SkuSnapshot`、`SkuHealthDiagnosis`、`CurrentSkuProjection` 和 workflow audit。
- WHEN 员工工作台请求 summary/list/detail，THEN API 返回稳定 DTO，且不要求前端拼装底层事实模型。
- WHEN 活动模拟、Review decision、Report preview 被调用，THEN 结果来自同一组 application service 和持久化对象。

串行任务:

- [ ] 1.1 对齐 L4 最小 route 清单和 DTO contract，冻结 request / response schema。
- [ ] 1.2 实现 `IngestRepository` 事务组合 profile、snapshot、diagnosis、projection。
- [ ] 1.3 绑定 `POST /api/ingest`、`GET /api/health/summary`、`GET /api/skus`、`GET /api/skus/:skuProfileId`。
- [ ] 1.4 实现 `ActivityRepository`，持久化 rule set、simulation run、simulation result。
- [ ] 1.5 绑定 `POST /api/activities/parse`、`POST /api/activities/:activityRuleSetId/simulations`。
- [ ] 1.6 实现 `ReviewRepository`、`ReportRepository` 的最小持久化。
- [ ] 1.7 绑定 `GET /api/reviews`、`POST /api/reviews/:reviewItemId/decision`、`POST /api/reports`。
- [ ] 1.8 补 route / service / repository 测试，输出下游解锁清单。

### 5.2 `final-agent-eventstore-foundation`

Requirement: Agent EventStore and ToolExecutor foundation

Agent 后端 MUST 通过 `AgentEventStore`、`AgentToolExecutor` 和 policy 层记录 run、event、tool call、review gate 和 evidence，并 SHALL 禁止 Pi adapter 直接访问业务 service 或 Prisma client。

Scenarios:

- WHEN Agent run 产生事件，THEN 后端先写 `AgentRunEvent.sequence`，再通过 SSE 推给前端。
- WHEN SSE 断线重连，THEN `GET /api/agent/runs/:runId/events?after=<sequence>` 返回缺失事件。
- WHEN Agent 调用工具，THEN 工具执行经过 `ToolPolicy`、`ReviewGatePolicy`、application service，并写入 `AgentToolCall`。

串行任务:

- [ ] 2.1 定义 `AgentEventStore.append/listAfter/markRunStatus/linkWorkflowStep` 接口。
- [ ] 2.2 实现 `AgentRepository` 对 `AgentSession`、`AgentMission`、`AgentRun`、`AgentRunEvent`、`AgentToolCall`、`AgentReviewGate` 的最小访问。
- [ ] 2.3 绑定 `POST /api/agent/missions`、`POST /api/agent/missions/:missionId/runs`、`GET /api/agent/runs/:runId/events`。
- [ ] 2.4 实现 `AgentToolExecutor`，统一输出 permission、riskLevel、reviewPolicy、evidenceRefs。
- [ ] 2.5 绑定 `POST /api/agent/review-gates/:gateId/decision`，默认创建 continuation run。
- [ ] 2.6 验证未注册工具、`coding`、`file`、`bash`、direct SQL、credential access 均不可用。

### 5.3 `final-browser-ingest-validation`

Requirement: Browser extension ingest validation

插件 MUST 在用户当前抖店页面上下文中完成受控采集和 ingest 提交，并 SHALL 不读取、不复制、不保存 Cookie、token 或平台敏感凭据。

Scenarios:

- WHEN 用户在抖店商品列表页触发采集，THEN 插件展示字段映射预览、分页范围、采集层风险和提交确认。
- WHEN 用户提交采集，THEN 插件调用真实 `POST /api/ingest` 并展示 ingest receipt。
- WHEN sale price、类目名称或状态字典缺失，THEN 插件只标记采集风险，不生成业务健康结论。

串行任务:

- [ ] 3.1 用脱敏 fixture 固定库存第一页、翻页、筛选、SKU 诊断四类输入。
- [ ] 3.2 验证 page/pageSize/page_size、排序和筛选参数不会丢字段。
- [ ] 3.3 将提交路径切到真实 `POST /api/ingest`，保留 mock fallback。
- [ ] 3.4 展示 ingest receipt、失败原因、采集风险和跳转员工工作台入口。
- [ ] 3.5 输出插件到 SKU 健康链路 HTTP smoke 与截图/录屏证据。

### 5.4 `final-staff-health-api-closure`

Requirement: Staff health console API closure

员工健康工作台 MUST 默认消费真实 summary/list/detail DTO，并 SHALL 只在开发或接口不可用时使用 mock fallback。

Scenarios:

- WHEN ingest 完成后打开 Dashboard，THEN summary 数量和状态分布能解释本次采集结果。
- WHEN 用户打开 SKU 详情，THEN 页面展示 snapshot、diagnosis、collection risk 和 evidence 来源。
- WHEN API 不可用，THEN 页面明确进入 fallback 状态，而不是静默宣告生产闭环完成。

串行任务:

- [ ] 4.1 对齐 `CurrentSkuProjection`、SKU list、SKU detail、connector status 的 DTO。
- [ ] 4.2 将 Dashboard / Connectors / SKU Health 默认数据源切到真实 API。
- [ ] 4.3 SKU detail 增加 snapshot、diagnosis、collection risk、evidence source 的可追溯展示。
- [ ] 4.4 补 API error / empty / fallback 状态，不在前端重算健康状态。
- [ ] 4.5 输出桌面和移动端浏览器验收截图。

### 5.5 `final-activity-simulation-closure`

Requirement: Activity simulation persistent closure

活动工作台 MUST 通过真实 parse/simulation API 生成活动上下文准入结论，并 SHALL 将 `ActivitySimulationResult` 与长期健康状态分开。

Scenarios:

- WHEN 用户提交活动规则文本，THEN 后端返回经 Zod 校验的 Rule DSL、parse status、confidence 和错误信息。
- WHEN 用户运行模拟，THEN 结果区分 `DIRECT_READY`、`REPAIRABLE_READY`、`MANUAL_REVIEW`、`BLOCKED`，并带 rule/evidence refs。
- WHEN 用户运行 what-if，THEN 系统返回对比结果，不修改真实 SKU 档案。

串行任务:

- [ ] 5.1 将活动规则解析接到真实 `POST /api/activities/parse`。
- [ ] 5.2 将模拟和 what-if 接到真实 simulation route。
- [ ] 5.3 为 `MANUAL_REVIEW` 结果提供创建或定位 Review item 的入口。
- [ ] 5.4 补 rule、simulation result、evidence 的可点击来源模型。
- [ ] 5.5 输出活动模拟到 Review / 报告前置链路 smoke。

### 5.6 `final-review-reporting-closure`

Requirement: Review decision and report snapshot closure

Review / Reports MUST 共用后端持久化状态和 evidence summary，并 SHALL 修复 Reports SSR / hydration 不稳定问题。

Scenarios:

- WHEN 用户批准、驳回或修改 Review item，THEN 刷新页面后决策状态仍保留。
- WHEN Reports 首屏渲染，THEN SSR 文本和客户端 hydration 文本一致。
- WHEN 用户查看 evidence summary，THEN 每条 evidence 可以定位到 source object、rule、simulation result、review item、workflow step 或 agent tool call。

串行任务:

- [ ] 6.1 将 Review 列表、详情、决策动作接到真实 Review API。
- [ ] 6.2 移除 Reports 首屏非确定性 runtime 快照，改为稳定 API snapshot 或确定性 fixture。
- [ ] 6.3 报告 preview 消费真实 `POST /api/reports` 输出，不重算业务结论。
- [ ] 6.4 为 Reviews 的对象入口、Reports evidence summary 增加链接或详情抽屉。
- [ ] 6.5 补 hydration 回归测试或浏览器 smoke，记录 React hydration error 为通过/失败证据。

### 5.7 `final-copilot-overlay-closure`

Requirement: Copilot overlay and workbench context closure

Agent Copilot MUST 从独立 `/agent-chat` 页面收敛为 console layout 常驻 Overlay / Sidecar，并 SHALL 通过 `WorkbenchContext`、SSE 和 Review Gate 与当前工作台对象联动。

Scenarios:

- WHEN 用户在任意主工作台页面打开 Copilot，THEN sidecar 能读取当前 route、selectedEntity、visibleFilters。
- WHEN Agent run 推送事件，THEN 消息、plan、trace、context link、evidence、review gate 分区持续更新。
- WHEN Review Gate 被批准，THEN 前端显示 continuation run，并能链接到 gate、run trace 和相关 Review item。

串行任务:

- [ ] 7.1 抽出 `agent-copilot` 模块组件，保留 `/agent-chat` 作为兼容入口。
- [ ] 7.2 在 console layout 注入 `AgentCopilotProvider`、floating bubble、sidecar panel。
- [ ] 7.3 为 Dashboard、SKU、Activities、Reviews、Reports 注册 `WorkbenchContext`。
- [ ] 7.4 实现 `useAgentRunEvents(runId)` 消费 SSE 和断线重放。
- [ ] 7.5 Review Gate next action 增加 gate / review / run trace 可点击入口。
- [ ] 7.6 输出多页面 Overlay 桌面和移动端截图。

### 5.8 `final-pi-tool-policy-poc`

Requirement: Pi runtime and policy POC

Agent runtime MUST 通过最小 Pi adapter 执行低风险业务工具，并 SHALL 对 L2 工具执行 Review Gate 策略，不允许默认高危工具进入业务 Agent。

Scenarios:

- WHEN Pi adapter 启动业务 run，THEN 只能看见 `AgentToolRegistry` 暴露的业务工具。
- WHEN run 调用 `parseActivityRules`、`simulateActivityReadiness`、`explainDecisionWithEvidence`，THEN 事件写入 EventStore 并通过 SSE 可见。
- WHEN run 尝试 L2 工具或未注册工具，THEN 系统创建 Review Gate 或拒绝调用。

串行任务:

- [ ] 8.1 对齐工具命名：`runSimulation` 兼容或迁移到 `simulateActivityReadiness`。
- [ ] 8.2 补 `explainDecisionWithEvidence`、`checkDataFreshness`、`diagnoseSkuHealth` 的最小工具。
- [ ] 8.3 接最小 Pi adapter，只开放 3 个低风险业务工具。
- [ ] 8.4 验证 L2 `createReviewItems` 先进入 Review Gate。
- [ ] 8.5 验证 continuation run 和 event replay。
- [ ] 8.6 输出 Agent 到真实业务工具链路日志和截图。

### 5.9 `final-cross-module-acceptance`

Requirement: Final cross-module acceptance

统一验收 MUST 按固定主链路执行，并 SHALL 为每条链路记录输入、关键 route、关键数据对象、验证证据、结论和回流模块。

Scenarios:

- WHEN L4 验收开始，THEN 按插件到 SKU 健康、活动模拟到 Review / 报告、员工工作台到 Agent、Agent 到真实业务工具的顺序执行。
- WHEN 某条链路阻塞，THEN 验收文档记录阻塞点、所属模块、修复分支和回归状态。
- WHEN 所有主链路通过，THEN 输出中文验收结论，明确 L4 accepted / P0 blocker / P1 risk。

串行任务:

- [ ] 9.1 准备统一 seed、fixture、浏览器验收脚本和证据目录。
- [ ] 9.2 验证链路 A：插件到 ingest / projection / Dashboard / SKU detail。
- [ ] 9.3 验证链路 B：活动规则到 simulation / Review / Reports。
- [ ] 9.4 验证链路 C：WorkbenchContext 到 Agent sidecar / SSE / Review Gate。
- [ ] 9.5 验证链路 D：Pi 或 fake fallback 到 ToolExecutor / application service / evidence。
- [ ] 9.6 输出中文验收报告和阻塞回流清单。

## 6. Worktree 分配

建议路径：

```text
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-api-persistence-foundation
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-agent-eventstore-foundation
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-browser-ingest-validation
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-staff-health-api-closure
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-activity-simulation-closure
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-review-reporting-closure
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-copilot-overlay-closure
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-pi-tool-policy-poc
/Users/haoqi/Documents/GitHub/worktrees/PickAgent/final-cross-module-acceptance
```

建议分支：

```text
codex/l4-final-api-persistence-foundation
codex/l4-final-agent-eventstore-foundation
codex/l4-final-browser-ingest-validation
codex/l4-final-staff-health-api-closure
codex/l4-final-activity-simulation-closure
codex/l4-final-review-reporting-closure
codex/l4-final-copilot-overlay-closure
codex/l4-final-pi-tool-policy-poc
codex/l4-final-cross-module-acceptance
```

## 7. 每个 Agent 的启动说明模板

```text
你在独立 worktree：<worktree path>
当前分支：<branch>
负责 OpenSpec change：<change id>
负责业务模块：<module>

先阅读：
- AGENTS.md
- docs/agents/profile.md
- docs/agents/workspace-template.md
- CONTEXT.md
- docs/architecture.md
- docs/engineering-rules.md
- docs/final-design-gap-closure.md
- docs/operations/pickagent-final-design-work-allocation.md
- 对应 OpenSpec change 下的 proposal.md、design.md、tasks.md、specs/**/spec.md

执行要求：
- 只做本 change 范围内的任务。
- 同一模块任务串行执行，完成一个 requirement 后提交一次代码。
- commit message 用中文写清楚完成的需求。
- 不修改其他模块的 OpenSpec task 状态。
- 需要共享 contract、repository 或 route 时，先回流到 final-api-persistence-foundation 或 final-agent-eventstore-foundation。
- 完成后运行必要验证，并在最终回复中给出命令、结果、截图/录屏路径、阻塞项和下一层依赖。
```

## 8. Review Gate

每个模块合并前必须回答：

- 本模块完成的是哪个 OpenSpec requirement。
- 是否改动了其他业务模块或共享 contract。
- 是否有 route、service、repository、DTO、UI、测试、截图证据。
- 是否仍依赖 mock / fake fallback；如果依赖，是否明确为非生产路径。
- 是否有 L4 blocker、P0 blocker、P1 risk。
- 是否可以用中文声明“已完成，不阻塞下一层”。

## 9. 当前执行建议

下一步先做 Layer 0：

1. 将本文拆成实际 OpenSpec change 目录或确认由现有 change 继续承接。
2. 先创建并实现 `final-api-persistence-foundation`。
3. 后端基座合并后，同时启动 Layer 4B 五个业务模块。
4. Layer 4B 完成后再启动 Pi POC 和最终统一验收。
