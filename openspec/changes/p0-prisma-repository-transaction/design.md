## Context

本子 change 收敛 L4 P1 risk：in-memory runtime 仍是默认验收存储。P0 目标不是重写业务，而是把 L4 已验证的 application service 语义迁移到 Prisma/PostgreSQL 主路径。

## Requirements Boundary

- `POST /api/ingest` 必须在事务内写入 SKU、snapshot、diagnosis、projection 和 workflow audit。
- health summary/list/detail 必须读取持久化 projection / DTO assembler。
- activity parse / simulation、review decision、report preview 必须读取或写入同一组 repository 对象。
- transaction helper 必须让 application service 显式声明事务边界。
- seed 默认注入必须可关闭，支持纯净验收数据模式。

## Forbidden Scope

- 不新增数据库底座。
- 不让 route handler 直接拼 SQL 或绕过 service。
- 不让前端补算 projection。
- 不静默修改已发布 migration。

## Verification

- `openspec validate p0-prisma-repository-transaction --strict`
- `./scripts/typecheck backend`
- `./scripts/test backend`
- repository / transaction integration test 覆盖重启后数据仍可查询。
- migration 审查记录影响范围与回滚思路。
