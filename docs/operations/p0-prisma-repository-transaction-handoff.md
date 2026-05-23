# p0-prisma-repository-transaction 交付说明

日期：2026-05-24

## 完成范围

- 冻结 L4 route / DTO contract：`POST /api/ingest`、health summary、SKU list/detail、activity parse/simulation、review list/decision、report preview 仍返回 `{ code, message, data, requestId }` envelope，DTO 名称和字段不改。
- 将 `FinalApiPersistenceFoundation` 的 service contract 调整为 async repository / transaction contract，route handler 改为 `await` 调用，保持 URL 与响应结构兼容。
- 新增 `PrismaTransactionManager`，让 ingest 明确在 `$transaction` 内写入。
- 新增 Prisma repository adapter：
  - `PrismaIngestRepository` 写入 `SkuProfile`、`SkuSnapshot`、`SkuHealthDiagnosis`、`CurrentSkuProjection`、`WorkflowRun`。
  - `PrismaSkuQueryRepository` 从 `CurrentSkuProjection` 与 latest snapshot / diagnosis 装配 health、list、detail DTO。
  - `PrismaActivityRepository` 持久化 rule set、simulation run、simulation result。
  - `PrismaReviewRepository` 持久化 review list/create/decision。
  - `PrismaReportRepository` 将 report preview 作为 `WorkflowRun` 审计输出保存，并读取 simulation result。
- `createFinalApiPersistenceRuntime` 支持 `adapter: "prisma" | "memory"` 和 `boundary` 参数；production / `DATABASE_URL` / `PICKAGENT_PERSISTENCE_ADAPTER=prisma` 默认选择 Prisma，`memory` 仅作为显式 dev/test fallback。
- `PICKAGENT_ACCEPTANCE_CLEAN=1` 或 Prisma adapter 下禁用默认 seed 注入，避免纯净验收 totals 被 fixture 污染。

## Migration 审查

- 本 change 未新增或修改已发布 migration。
- 复用现有 Prisma schema 与 migrations：
  - `20260523162500_init`
  - `20260523174500_add_agent_copilot_tables`
- 影响表：`sku_profiles`、`sku_snapshots`、`sku_health_diagnoses`、`current_sku_projections`、`activity_rule_sets`、`activity_simulation_runs`、`activity_simulation_results`、`review_items`、`workflow_runs`。
- 回滚思路：代码层将 `PICKAGENT_PERSISTENCE_ADAPTER=memory` 作为显式 dev/test fallback；生产回滚应回滚本 commit 或临时关闭生产写入入口，不应删除既有 migration 或 truncate 业务表。

## 验证结果

- `openspec validate p0-prisma-repository-transaction --strict`：通过。
- `./scripts/typecheck backend`：通过，包含 Prisma schema validate 与 backend src strict TypeScript check。
- `./scripts/test backend`：当前脚本等价执行 backend typecheck，可通过同一 backend check 覆盖。
- `./scripts/typecheck repo`：阻塞于 `apps/frontend/node_modules` 缺失，错误为找不到 `next` / `react` 类型；未发现 backend src 编译错误。
- route-level smoke：当前环境未提供真实 PostgreSQL 连接和生成后的 `@prisma/client` runtime，未执行真实 Postgres HTTP smoke，不能声明重启恢复已实测通过。

## P0 Blocker / P1 Risk

- P0 blocker：真实 Postgres 未在当前环境完成 smoke。当前代码已让 production / `DATABASE_URL` 默认选择 Prisma adapter，但需要安装前端依赖、生成 Prisma client，并提供 `DATABASE_URL` 后才能做 build/start + HTTP 重启恢复证明。
- P0 blocker：`@prisma/client` runtime bootstrap 依赖实际安装和 generate；当前 worktree 只有 Prisma schema validate，没有真实 client 生成物。
- P1 risk：in-memory adapter 仍保留，但限定为显式 `PICKAGENT_PERSISTENCE_ADAPTER=memory` 或无 DB 的 dev/test fallback。
- P1 risk：Prisma adapter 先使用现有表与 JSON evidence，不拆 `EvidenceRef`。
- P1 risk：tenant/session boundary 已进入 transaction helper 参数，但完整生产 auth enforcement 属于 `p0-auth-boundary-and-runtime-config`。

## 下游解锁

- 解锁 `p0-agent-eventstore-persistence` 的 repository / transaction 复用方向：使用 async transaction helper，并把 Agent repository 绑定到同一 Prisma client / boundary。
- 解锁 `p0-auth-boundary-and-runtime-config` 的 repository boundary 传递：`PersistenceBoundary` 已包含 `tenantId`、`sessionId`、`actorId`。
- 未完全解锁 `p0-production-acceptance-smoke`：仍需真实 Postgres、Prisma client generate、build/start route smoke 后归档证据。
