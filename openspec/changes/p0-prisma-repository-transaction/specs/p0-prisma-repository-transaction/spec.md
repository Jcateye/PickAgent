## ADDED Requirements

### Requirement: Prisma repository transaction main path
后端生产 API 主路径 MUST 使用 Prisma/PostgreSQL repository 和 transaction，并 SHALL 保持 L4 已验收 route / DTO contract 兼容。

#### Scenario: Persist ingest in one transaction
- **WHEN** `POST /api/ingest` receives a valid payload
- **THEN** the service writes `SkuProfile`, `SkuSnapshot`, `SkuHealthDiagnosis`, `CurrentSkuProjection`, and workflow audit in one transaction.

#### Scenario: Query after restart
- **WHEN** the app restarts after ingest, activity simulation, review decision, or report preview
- **THEN** the corresponding API response is restored from PostgreSQL rather than in-memory state.

#### Scenario: Disable default seed for clean acceptance
- **WHEN** production acceptance requests a clean fixture run
- **THEN** default seed data is disabled or isolated so totals reflect the acceptance fixture.
