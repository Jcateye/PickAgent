## Why

前五个业务模块可以在 mock 先行的策略下并行推进，底层业务能力由 `backend-business-foundation` 承接，但最终仍需要一个统一的 change 来承接跨模块联调、验收与问题收口。这个 change 的目标不是新增单点功能，而是把插件、员工工作台、活动模拟、Review/报告、Agent 工作台和后端业务基座打通为可验收的系统。

## What Changes

- 交付跨模块联调与最终验收流程，覆盖插件→ingest→SKU 健康、活动模拟→Review/报告、员工工作台↔Agent 工作台、Agent tool↔真实业务服务等主链路。
- 约束只有该模块承担统一阻塞与最终收口，前置业务模块不因共享后端而被强制串行。
- 建立最终验收标准、联调顺序、阻塞判定和问题回归机制。
- 不在该模块内新增新的单点业务能力，重点放在连接、验证、收口与验收。

## Capabilities

### New Capabilities
- `cross-module-integration`: 系统允许在所有业务模块达到各自“已完成且不阻塞”后，按统一顺序完成跨模块联调与最终验收。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/extension/`, `apps/frontend/`, `apps/backend/`, `apps/contracts/`
- Affected systems: 插件、员工工作台、Agent 工作台、真实业务服务与验收流程
- Dependencies: 强依赖前五个业务模块和 `backend-business-foundation` 各自完成对应“已完成且不阻塞”准入条件；该 change 是统一收口与最终阻塞点
