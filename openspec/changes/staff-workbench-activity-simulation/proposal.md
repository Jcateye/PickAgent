## Why

活动规则录入与准入模拟是员工工作台中的独立业务场景，不能仅作为后端服务分层的附属部分来推进。这个 change 需要把“贴规则、看结构化结果、看模拟结论与修复建议”整理成可单独分派的业务模块，并允许前期用 mock 数据独立开发。

## What Changes

- 交付员工工作台中的活动规则与准入模拟模块，包括规则输入、结构化规则展示、模拟结果、失败原因与修复建议展示。
- 模块内部按串行任务推进，先完成页面结构和 mock 交互，再在模块最后接入真实 rule parse 与 simulation 接口。
- 约束该模块不负责 Review 审批决策、不负责 Agent 会话编排，也不承担插件采集逻辑。
- 为后续 Review 工作台和 Agent 工具调用提供稳定的规则与模拟结果消费面。

## Capabilities

### New Capabilities
- `activity-simulation-workbench`: 员工工作台允许用户录入活动规则、查看结构化解析结果，并查看 SKU 准入模拟与修复建议。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/frontend/src/modules/activity/`, `apps/backend` 中 activity rule / simulation API 对接面，`apps/contracts/`
- Affected systems: 活动规则录入页、结构化规则视图、模拟结果视图
- Dependencies: 开发阶段允许 mock 先行；真实 rule parse / simulation / what-if 接入依赖 `backend-business-foundation` 中 Rule DSL 与 ActivitySimulationService 能力完成
