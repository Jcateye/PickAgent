## Why

员工工作台已经有 Dashboard、Connectors、SKU 健康等页面壳，但还没有形成可分派、可联调的业务模块定义。这个 change 需要把“运营总览与 SKU 健康工作台”作为独立业务闭环先落结构，并允许前期使用 mock 数据推进页面实现。

## What Changes

- 交付员工工作台中的总览与 SKU 健康模块，包括 Dashboard、Connectors、SKU 列表、SKU 详情和最近运行摘要。
- 明确该模块内部串行推进，前期以 mock 数据完成页面结构、状态流和导航关系，最后再对接真实查询接口。
- 约束该模块不承担活动规则解析、准入模拟、Review 审批和 Agent Copilot 逻辑。
- 为后续活动模拟、Agent 上下文联动和跨模块联调提供稳定页面入口与读模型消费面。

## Capabilities

### New Capabilities
- `staff-health-console`: 员工工作台提供运营总览、连接器状态、SKU 健康列表与详情查看能力，并在模块末尾接入真实查询接口。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/frontend/src/modules/dashboard/`, `apps/frontend/src/modules/connectors/`, `apps/frontend/src/modules/sku/`
- Affected systems: Dashboard、Connectors、SKU 健康页面与读模型查询接口
- Dependencies: 开发阶段允许使用 mock 数据；真实 summary / sku / connector / workflow 查询依赖 `backend-business-foundation` 中 ingest / health projection / SkuQueryService 能力完成
