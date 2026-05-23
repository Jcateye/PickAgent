## Why

L4 验收通过但主路径仍依赖 in-memory runtime，服务重启后数据清空。P0 必须把后端业务主链路切到 Prisma/PostgreSQL repository 与 transaction，保持现有 route / DTO 兼容。

## What Changes

- 冻结 Prisma repository / transaction 子 change。
- 要求 ingest、health projection、activity simulation、review、report 和 workflow audit 使用真实持久化主路径。
- 明确 in-memory runtime 只能作为测试 fixture 或显式开发 fallback。

## Capabilities

### New Capabilities
- `p0-prisma-repository-transaction`: 后端生产 API 主路径 MUST 使用 Prisma/PostgreSQL repository 和 transaction，并 SHALL 保持 L4 已验收 route / DTO contract 兼容。

## Impact

- Affected systems: backend API, repositories, transactions, Prisma schema/migrations, workflow audit
- Dependencies: `final-api-persistence-foundation`
- Parallel rule: 优先启动并优先合并；AgentEventStore persistence 可等待 repository interface 稳定后并行。
