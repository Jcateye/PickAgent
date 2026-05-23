## Why

Review 工作台与报告输出是员工工作台中的另一条完整业务链路，既承接人工审批，也承接业务结果输出。这个 change 需要把它从活动模拟和 Agent 模块中独立出来，形成可单独分派的业务模块，并允许前期先用 mock 任务和 mock 报告推进页面能力。

## What Changes

- 交付 Review 工作台与报告模块，包括 Review 列表、Review 详情、决策区、报告预览与导出占位。
- 明确模块内部采用串行任务推进，先完成 mock 数据下的列表、详情和决策流，再在模块最后接入真实 review / report 接口。
- 约束该模块不负责活动规则解析、不负责插件采集、不负责 Agent 会话运行时。
- 为跨模块联调提供统一的人工确认入口与结果输出面。

## Capabilities

### New Capabilities
- `review-reporting-workbench`: 员工工作台允许用户查看和处理 Review 项，并查看活动或健康报告的预览与输出结果。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/frontend/src/modules/review/`, `apps/frontend/src/modules/report/`, `apps/backend` 中 review / report API 对接面
- Affected systems: Review 列表/详情、报告预览与导出占位
- Dependencies: 开发阶段允许 mock 先行；真实 review / report 接入依赖 `backend-business-foundation` 中 ReviewService / ReportService 能力完成
