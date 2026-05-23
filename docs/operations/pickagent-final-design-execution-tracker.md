# PickAgent 最终设计执行跟踪文档

日期：2026-05-23

本文把 `docs/operations/pickagent-final-design-work-allocation.md` 的分层推进规则落成可执行跟踪口径。Layer 0 只冻结 OpenSpec 和验收模板，不实现业务代码。

## 1. Change 清单与依赖

| 层级 | OpenSpec change | 模块 | 依赖 | 并行规则 | mock/fake 策略 |
|---|---|---|---|---|---|
| Layer 0 | `final-design-work-allocation` | workflow / docs / spec freeze | 当前最终设计输入文档 | 串行；冻结完成后才允许启动 Layer 4A。 | 不涉及 mock/fake；本 change 只冻结文档和验收模板。 |
| Layer 4A | `final-api-persistence-foundation` | 后端业务基座 | Layer 0；复用 backend-business-foundation 的 service 语义，但升级为真实 route/repository/transaction 主路径。 | 串行，优先合并；下游 4B 必须等待对应 route 可用。 | 允许测试 fixture；生产默认路径 SHALL NOT 依赖内存 runtime 或 mock fallback。 |
| Layer 4A | `final-agent-eventstore-foundation` | Agent 后端基座 | Layer 0；依赖 final-api-persistence-foundation 的 model / repository 决策。 | 可和后端基座后半段协作，但 merge 顺序在 API/persistence 基座之后。 | 允许 fake adapter 写同一 EventStore contract；生产路径 SHALL NOT 让 Pi adapter 直接访问 Prisma 或业务 service。 |
| Layer 4B | `final-browser-ingest-validation` | 浏览器插件 | Layer 0；等待 final-api-persistence-foundation 提供 ingest route。 | 与其他 Layer 4B 模块并行；不得修改后端 repository 边界。 | 允许脱敏 fixture 和 mock fallback；真实提交通路必须默认走 `POST /api/ingest`。 |
| Layer 4B | `final-staff-health-api-closure` | Dashboard / SKU Health | Layer 0；等待 health summary/list/detail route 可用。 | 与其他 Layer 4B 模块并行；不得在前端重算 health 或 projection。 | 允许开发 fallback；生产默认 SHALL 消费真实 API DTO。 |
| Layer 4B | `final-activity-simulation-closure` | Activities | Layer 0；等待 activity parse/simulation route 可用。 | 与其他 Layer 4B 模块并行；不得修改长期 health 状态语义。 | 允许 deterministic parser fixture；默认模拟结果 SHALL 来自真实 parse/simulation API。 |
| Layer 4B | `final-review-reporting-closure` | Reviews / Reports | Layer 0；等待 review/report route 可用，可先用 activity fixture。 | 与其他 Layer 4B 模块并行；不得在 Reports 前端重算业务结论。 | 允许确定性 fixture；生产默认 SHALL 使用持久化 Review/Report API snapshot。 |
| Layer 4B | `final-copilot-overlay-closure` | Agent Copilot 前端 | Layer 0；等待 Agent mission/run/events route 可用。 | 与其他 Layer 4B 模块并行；不得新增私有业务工具或绕过 AgentToolRegistry。 | 允许 fake runtime adapter 驱动 UI；生产路径 SHALL 使用 EventStore/SSE contract。 |
| Layer 4C | `final-pi-tool-policy-poc` | Pi runtime / ToolPolicy | Layer 0；等待 EventStore、ToolExecutor、Overlay 基本可用。 | 串行；必须在 Layer 4B 不阻塞后启动。 | fake adapter 只可作为 contract fallback；Pi POC 必须证明真实 adapter 只看到业务工具。 |
| Layer 4D | `final-cross-module-acceptance` | 统一联调验收 | Layer 0；等待 Layer 4B、Layer 4C 全部不阻塞。复用上一轮 cross-module-integration-and-acceptance 的验收经验，但新增 final 口径。 | 串行；不得在上游阻塞未关闭时宣告最终验收完成。 | 允许记录 fake fallback 的 contract 证明；最终结论 MUST 标明 L4 accepted / P0 blocker / P1 risk。 |

## 2. 旧 change 承接关系

上一轮 `backend-business-foundation`、`browser-extension-full-ingest`、`staff-workbench-*`、`agent-copilot-workbench`、`cross-module-integration-and-acceptance` 已证明 Layer 3 可演示集成闭环。

本轮仍创建 `final-*` change，原因是最终设计收敛的验收口径已经升级：真实 route binding、repository / transaction、AgentEventStore、SSE replay、Copilot Overlay、Pi ToolPolicy 和最终跨模块证据需要独立冻结，避免把 P0/最终验收边界混入已完成的 Layer 3 结论。

## 3. 推进规则

- Layer 0 完成后，先启动 `final-api-persistence-foundation`。
- `final-agent-eventstore-foundation` 等待 API / repository 决策稳定后合并。
- Layer 4B 五个业务模块可以并行，但只能在所需 route 或 EventStore contract 可用后切真实路径。
- `final-pi-tool-policy-poc` 必须等待 EventStore、ToolExecutor、Overlay 基本可用。
- `final-cross-module-acceptance` 必须等待 Layer 4B 与 Layer 4C 全部不阻塞。

## 4. Review Gate 模板

每个执行 Agent 完成时必须回答：

- 完成的是哪个 OpenSpec requirement。
- 是否改动其他业务模块或共享 contract。
- 是否有 route、service、repository、DTO、UI、测试、截图/录屏证据。
- 是否仍依赖 mock / fake fallback；如果依赖，是否明确为非生产路径。
- 是否有 L4 blocker、P0 blocker、P1 risk。
- 是否可以用中文声明“已完成，不阻塞下一层”。

## 5. Layer 0 完成判定

- 10 个 `final-*` change 均包含 `proposal.md`、`design.md`、`tasks.md`、`specs/<capability>/spec.md`。
- 每个 spec requirement 使用 MUST / SHALL。
- 每个 scenario 使用 WHEN / THEN。
- 每个 `tasks.md` 保留分工文档 5.x 的任务编号。
- `openspec validate <change> --strict` 全部通过，或记录命令不可用/阻塞原因。

## 6. P0 生产化最小层执行跟踪

日期：2026-05-24

L4 已 accepted，P0 无已知 blocker，但存在需要回流的生产化 P1 risk。P0 不直接扩张业务能力，只收敛生产默认路径、Agent 持久化审计、最小鉴权边界和 build/start 验收。

| 层级 | OpenSpec change | 模块 | 依赖 | 并行规则 | 完成判定 |
|---|---|---|---|---|---|
| P0 | `p0-production-minimum-foundation` | 规格冻结 / 分工 | L4 accepted；P1 risk 清单 | umbrella，不承载业务实现 | 子 change、分工文档、验证口径全部冻结。 |
| P0.1 | `p0-prisma-repository-transaction` | 后端 persistence | `final-api-persistence-foundation` | 优先启动并优先合并 | Prisma/PostgreSQL repository + transaction 成为生产 API 主路径，in-memory 仅保留非生产 fallback。 |
| P0.2 | `p0-agent-eventstore-persistence` | Agent backend | `final-agent-eventstore-foundation`；repository interface 稳定 | 可与 P0.1 后半段并行，merge 晚于 P0.1 | AgentEventStore/SSE replay 可重启恢复，AgentRun/ToolCall/ReviewGate 进入 Workflow/Review 审计链。 |
| P0.3 | `p0-auth-boundary-and-runtime-config` | Auth / runtime safety | L4 route contract；ToolPolicy contract | 可与 P0.1/P0.2 并行，production smoke 前合并 | 生产 API enforced actor/tenant/session；Pi production adapter 只暴露低风险业务工具。 |
| P0.4 | `p0-production-acceptance-smoke` | 生产验收 | P0.1、P0.2、P0.3 | 最后合并 | build/start 模式 smoke 覆盖 L4 A/B/C/D、persistence restart、Agent replay、dangerous tool denial 和证据归档。 |

### P0 推进规则

- P0 执行必须从子 change 启动，不在 umbrella change 下直接提交业务实现。
- `p0-prisma-repository-transaction` 是 production merge 第一优先级。
- `p0-agent-eventstore-persistence` 可并行设计，但合并必须晚于 repository / transaction 主路径。
- `p0-auth-boundary-and-runtime-config` 必须在 production smoke 前合并。
- `p0-production-acceptance-smoke` 只能在 build/start 模式通过后声明 P0 production acceptance。

### P0 blocker / P1 risk 口径

- P0 blocker：生产默认路径仍依赖 in-memory；重启后数据不可恢复；生产 API 无 actor/tenant/session 边界；Pi adapter 可见危险工具；AgentReviewGate 不关联正式 ReviewItem；Copilot Overlay 默认 fake；未跑 build/start smoke。
- P1 risk：in-memory 仅作为测试或显式 dev fallback；seed 已可隔离但仍存在；EvidenceRef 未拆表；production smoke 不覆盖性能/HA/完整 IAM；兼容旧工具别名但 production adapter 不暴露。
