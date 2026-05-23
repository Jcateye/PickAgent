# PickAgent P0 生产化最小层分工文档

日期：2026-05-24

## 1. 目标

P0 生产化最小层只收敛 L4 accepted 后留下的 P1 risk，不直接扩张业务功能。执行目标是把演示可用的 L4 主链路升级为可恢复、可审计、可按生产启动方式验收的最小生产路径。

输入缺口：当前 worktree 未找到 `docs/final-design-gap-closure.md`，因此本分工以 `docs/operations/final-cross-module-acceptance-report.md`、`docs/operations/pickagent-final-design-execution-tracker.md`、`docs/agent-backend-data-architecture.md`、`docs/db-guidelines.md`、`docs/pi-agent-copilot-design.md` 和三个 handoff 为依据。

## 2. OpenSpec changes

| 顺序 | Change | 目标 | 依赖 | 推荐 agent | 推荐 branch / worktree |
|---|---|---|---|---|---|
| 0 | `p0-production-minimum-foundation` | umbrella 规格冻结和验收口径 | L4 accepted | Spec owner | `p0/production-minimum-foundation` / `../p0-production-minimum-foundation` |
| 1 | `p0-prisma-repository-transaction` | Prisma/PostgreSQL repository + transaction 替代 in-memory 主路径 | `final-api-persistence-foundation` | Backend persistence agent | `p0/prisma-repository-transaction` / `../p0-prisma-repository-transaction` |
| 2 | `p0-agent-eventstore-persistence` | AgentEventStore 持久化、SSE replay、Workflow/Review 审计链 | repository interface 稳定；`final-agent-eventstore-foundation` | Agent backend agent | `p0/agent-eventstore-persistence` / `../p0-agent-eventstore-persistence` |
| 3 | `p0-auth-boundary-and-runtime-config` | 生产 API auth/tenant/session 边界和 Pi runtime allowlist | L4 route contract；可与 1/2 并行 | Security/runtime agent | `p0/auth-boundary-runtime-config` / `../p0-auth-boundary-runtime-config` |
| 4 | `p0-production-acceptance-smoke` | build/start 模式 production smoke 和证据归档 | 1、2、3 合并后 | Acceptance agent | `p0/production-acceptance-smoke` / `../p0-production-acceptance-smoke` |

## 3. Merge 顺序

1. 先合并 `p0-prisma-repository-transaction`，确保生产默认 persistence 主路径存在。
2. 再合并 `p0-agent-eventstore-persistence`，确保 Agent runtime state、SSE replay、Workflow/Review 审计链可恢复。
3. 再合并 `p0-auth-boundary-and-runtime-config`，确保生产 API 和 Pi adapter fail-closed。
4. 最后合并 `p0-production-acceptance-smoke`，用 build/start 模式证明前三项已进入生产启动口径。

`p0-agent-eventstore-persistence` 和 `p0-auth-boundary-and-runtime-config` 可在接口冻结后并行开发，但不得早于 repository 主路径完成 production merge。`p0-production-acceptance-smoke` 可提前写 stub / 文档，不得提前声明通过。

## 4. 任务边界

### 4.1 Prisma repository / transaction

- MUST 使用 Prisma/PostgreSQL repository 与 transaction 作为生产 API 主路径。
- SHALL 保持 L4 已验收 route / DTO contract 兼容。
- MUST 支持纯净验收数据模式，避免默认 seed 污染 totals。
- SHALL 覆盖 ingest、health projection、activity simulation、review、report、workflow audit。

验证命令：

- `openspec validate p0-prisma-repository-transaction --strict`
- `./scripts/typecheck backend`
- `./scripts/test backend`
- 后续实现应补持久化 integration test，证明服务重启后数据仍可查询。

### 4.2 AgentEventStore persistence

- MUST 持久化 AgentRun、AgentRunEvent、AgentToolCall、AgentReviewGate。
- SHALL 支持 `GET /api/agent/runs/:runId/events?after=<sequence>` replay。
- MUST 关联 AgentRun 到 WorkflowRun，重要 tool call 到 WorkflowStep 或等价审计 evidence。
- MUST 让 AgentReviewGate 创建或关联正式 ReviewItem。
- SHALL 让 Copilot Overlay 默认走真实 EventStore/SSE contract。

验证命令：

- `openspec validate p0-agent-eventstore-persistence --strict`
- `./scripts/typecheck backend`
- Agent EventStore integration test 和 HTTP smoke。

### 4.3 Auth boundary / runtime config

- MUST 在生产 API enforced actor、tenant、session 或等价最小上下文。
- MUST 在生产模式 fail-closed，不能自动回退无鉴权 dev mode。
- SHALL 把 tenant/session boundary 传入 repository query/write。
- MUST 让 Pi production adapter 只暴露低风险业务工具。
- MUST 禁止 coding、file、bash、sql、credential、cookie、token、JWT、SSO、secret、api key。

验证命令：

- `openspec validate p0-auth-boundary-and-runtime-config --strict`
- route guard 单测。
- ToolPolicy allowlist / denylist 单测。
- production config smoke。

### 4.4 Production acceptance smoke

- MUST 使用 build/start 模式，不用 dev-only 截图声明 production pass。
- SHALL 覆盖 L4 链路 A/B/C/D。
- MUST 覆盖重启后 persistence 查询、Agent replay、ReviewItem 关联、dangerous tool denial。
- SHALL 归档 JSON、日志、截图和中文验收报告。

验证命令：

- `openspec validate p0-production-acceptance-smoke --strict`
- `./scripts/build`
- `./scripts/start`
- `node scripts/p0-production-acceptance-smoke.mjs` 或后续等价脚本。

## 5. P0 blocker 判定

以下任一项出现即为 P0 blocker：

- 生产默认路径仍依赖 in-memory runtime 保存业务主数据或 Agent runtime state。
- 服务重启后 L4 主链路数据、Agent events 或 review gate 无法恢复。
- 生产 API 可在缺失 actor、tenant、session 边界时写入或读取数据。
- Pi production adapter 可见或可执行 coding、file、bash、sql、credential、cookie/token/JWT/SSO/secret/api key 能力。
- AgentReviewGate 无法创建或关联正式 ReviewItem。
- Copilot Overlay 默认依赖 fake runtime，无法从 EventStore/SSE replay 恢复。
- P0 验收只跑 dev server，未跑 build/start smoke。

## 6. P1 risk 判定

以下属于 P1 risk，可不阻塞 P0 开工，但必须在子 change handoff 中记录：

- 仍保留 in-memory adapter，但仅用于测试 fixture 或显式开发 fallback。
- seed 数据仍存在，但 production acceptance 已能用纯净模式或隔离 tenant/session。
- ReviewItem 关联先采用 nullable FK 或 evidence JSON，后续再拆更细 EvidenceRef 表。
- production smoke 覆盖最小闭环，但性能、负载、HA、完整 IAM 不在 P0 范围。
- `runSimulation` 等兼容别名仍存在，但 production Pi adapter 不暴露旧高风险入口。

## 7. Review Gate 模板

每个 P0 执行 Agent 完成时必须用中文回答：

- 完成的是哪个 OpenSpec requirement。
- 改动了哪些 route、repository、transaction、EventStore、ToolPolicy、UI contract 或 scripts。
- 验证命令与结果是什么。
- 证据路径是什么。
- 是否仍依赖 mock/fake/in-memory fallback；若依赖，是否只在非生产路径。
- 是否有 P0 blocker 或 P1 risk。
- 是否可以合并，并是否解锁下一个 change。

## 8. 当前开工判定

- P0 OpenSpec 规格可开工：是。
- P0 业务实现可直接从 umbrella change 开工：否，必须从子 change 分工启动。
- 推荐并行启动：`p0-prisma-repository-transaction`、`p0-agent-eventstore-persistence` 的接口预研、`p0-auth-boundary-and-runtime-config`。
- 推荐暂缓：`p0-production-acceptance-smoke` 的最终通过声明，等待前三个子 change 合并后执行。
