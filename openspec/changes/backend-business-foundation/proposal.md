## Why

当前代码已经生成 Prisma、CRUD、OpenAPI 与页面/插件壳，但会阻塞多个业务模块的底层业务能力仍未显式排期。若各业务模块都先用 mock 并行推进，最后会同时卡在 ingest、SKU 当前读模型、Rule DSL、Simulation、Review/Report 和 Agent Tool Registry 上。

这个 change 不是按服务层粗拆后端，而是补齐跨业务模块共享的最小业务能力基座，让上层模块在各自完成 mock 闭环后，可以逐步替换为真实 service，并明确哪些能力完成后可声明“已完成，不阻塞”。

## What Changes

- 交付最小 ingest / normalization / health projection 链路，支撑插件真实提交与员工健康工作台真实查询。
- 交付最小 Rule DSL 校验、活动模拟和 what-if 能力，支撑活动模拟模块真实接入。
- 交付最小 ReviewService、ReportService 与结构化 evidence 产出，支撑 Review/报告模块真实接入。
- 交付 AgentToolRegistry 的最小工具注册与 fake/runtime adapter 边界，支撑 Agent 工作台真实工具接线。
- 为前五个业务模块提供统一 fixture、contract、测试与“已完成且不阻塞”判定依据。

## Capabilities

### New Capabilities
- `backend-business-foundation`: 后端提供跨业务模块共享的最小业务能力基座，包括 ingest、SKU 当前读模型、规则模拟、Review/报告和 Agent 工具注册。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/backend/src/application/`, `apps/backend/src/domain/`, `apps/backend/src/tools/`, `apps/backend/src/schemas/`, `apps/contracts/`, `apps/backend/tests/`
- Affected systems: 插件真实提交、员工工作台真实查询、活动模拟真实接口、Review/报告真实接口、Agent 工具接线
- Dependencies: 依赖现有 Prisma schema、CRUD scaffold 与 OpenAPI scaffold；不引入新的运行时底座，不新增 NestJS、Redis、InsForge
- Downstream unblock:
  - `browser-extension-full-ingest` 的真实 ingest 接入
  - `staff-workbench-health-console` 的真实 summary / sku / connector / workflow 查询
  - `staff-workbench-activity-simulation` 的真实 parse / simulation / what-if
  - `staff-workbench-review-reporting` 的真实 review / report
  - `agent-copilot-workbench` 的真实业务工具调用
