## Why

Agent 工作台已经有产品设计和后端数据模型，但当前前端仍是占位，运行时与工具调用闭环也未完成。这个 change 需要把 Agent Copilot 作为一个完整业务模块落地，而不是拆成前端、后端、Hermes 三个分散的服务任务。

## What Changes

- 交付 Agent Copilot 工作台业务闭环，包括 Mission 输入、Plan、Trace、Context、Evidence、Review Gate 与继续执行流程。
- 模块内部按串行任务推进，允许前期用 mock message、mock event stream、mock tools 推进 UI 与接口协议，最后再接入真实 Hermes/Pi runtime 与业务工具。
- 约束该模块不直接承载员工工作台确定性页面逻辑，也不在模块内实现插件采集或 Review 业务真相。
- 为最终跨模块联调提供统一的 Agent run 生命周期与上下文联动入口。

## Capabilities

### New Capabilities
- `agent-copilot-workbench`: Agent 工作台允许用户发起 Mission、查看执行计划与工具轨迹、处理 Review Gate，并在模块最后接入真实运行时与业务工具。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/frontend/src/modules/chat/`, `apps/backend` 中 agent mission/run/message/tool/gate 相关模块，`apps/contracts/`
- Affected systems: Agent Copilot UI、SSE 事件流、tool registry、Hermes/Pi runtime 适配层
- Dependencies: 开发阶段允许 mock 先行；真实 runtime 与业务工具联调依赖 `backend-business-foundation` 中 AgentToolRegistry / business service 能力完成。Hermes 工程若作为外部 runtime 存在，本模块只通过 adapter contract 接入
