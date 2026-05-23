## Context

`p0-production-minimum-foundation` 是 L4 accepted 之后的生产化最小层。它不新增业务愿景，不扩大 Agent 自治等级，只把 L4 暴露的 P1 risk 收敛成生产默认路径。

输入依据：

- `docs/operations/final-cross-module-acceptance-report.md`
- `docs/operations/pickagent-final-design-execution-tracker.md`
- `docs/agent-backend-data-architecture.md`
- `docs/db-guidelines.md`
- `docs/pi-agent-copilot-design.md`
- `docs/operations/final-api-persistence-foundation-handoff.md`
- `docs/operations/final-agent-eventstore-foundation-handoff.md`
- `docs/operations/final-pi-tool-policy-poc-handoff.md`

输入缺口：当前 worktree 未找到 `docs/final-design-gap-closure.md`，因此本 change 以 L4 验收报告和 handoff 中已确认的 P1 risk 为冻结依据。

## Dependency Order

1. `p0-prisma-repository-transaction`
2. `p0-agent-eventstore-persistence`
3. `p0-auth-boundary-and-runtime-config`
4. `p0-production-acceptance-smoke`

`p0-agent-eventstore-persistence` 可以在 Prisma 基础接口稳定后并行开发，但合并必须晚于 repository / transaction 主路径。`p0-production-acceptance-smoke` 最后合并，因为它证明前三者已进入 build/start 生产态。

## Boundary

- 只允许 production minimum foundation，不实现新业务流程。
- Route / DTO contract 应保持 L4 已验收主链路兼容。
- Prisma / PostgreSQL 是生产默认 persistence；in-memory 只能保留为测试 fixture 或显式开发 fallback。
- Agent runtime 只能通过 EventStore、ToolExecutor、ToolPolicy、application service 间接访问业务能力。
- AgentReviewGate 必须能创建或关联正式 `ReviewItem`，不能只停留在 runtime-only gate。

## Forbidden Scope

- 不引入 NestJS、Redis、InsForge 或新的后端/runtime 底座。
- 不暴露 coding、file、bash、sql、credential、cookie、token、JWT、SSO、secret、api key 工具给生产 Pi adapter。
- 不让 Copilot Overlay 默认走 fake runtime。
- 不用 dev-only screenshot 声明生产验收通过。
- 不在本 change 直接修改业务代码。

## Verification

- OpenSpec: `openspec validate p0-production-minimum-foundation --strict`。
- 子 change strict validate 全部通过。
- P0 开工前必须确认分工文档列出的验证命令、证据目录和 P0 blocker / P1 risk 判定。
- P0 完成验收必须使用 build/start 模式 smoke，而不是只用 Next dev。

## Handoff

完成本规格冻结后，执行 Agent 必须从子 change 启动，不直接在 umbrella change 下提交业务实现。每个子 change 完成时必须用中文说明 requirement、验证结果、证据路径、残留 P1 risk 和是否可合并。
