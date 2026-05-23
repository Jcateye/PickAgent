## Context

Agent Copilot 已经有明确的产品定位、后端数据模型与架构设计，但前端仍是占位，运行时与工具闭环也尚未打通。为了方便后续分派给不同负责人，这个 change 必须按“用户感知的 Agent 工作台业务模块”定义，而不是拆成前端、后端、Hermes 三个服务任务。开发阶段允许 mock message、mock event stream 与 mock tool result 先推进 UI 和协议，真实 runtime 与业务工具接入放在模块最后。

本仓统一以 `AgentLoopAdapter`、`AgentToolRegistry` 和 event contract 表达 runtime 边界。Hermes 工程若作为外部 runtime 或 Pi 的承载工程存在，不直接渗透到业务 service、前端页面或数据库访问层；真实接入必须适配同一 contract。

## Goals / Non-Goals

**Goals:**
- 提供 Mission 输入、对话流、Plan、Trace、Context、Evidence 与 Review Gate UI。
- 定义 Agent 工作台的前后端 contract，包括 Mission、Run、Event 与 Gate 的最小协议。
- 支持在 mock 阶段演示完整 run 生命周期与暂停/继续流程。
- 在模块最后接入真实 Hermes/Pi runtime 与业务工具。

**Non-Goals:**
- 不在本模块中重建员工工作台的确定性业务页面。
- 不在本模块中实现插件采集逻辑。
- 不在本模块中重写 Review 业务真相，只消费 Review Gate 和 ReviewItem 关联结果。
- 不要求在模块初期就完成全部真实工具接线。

## Decisions

1. Agent 工作台先按“业务工作台”而不是“纯聊天页”实现，Mission、Plan、Trace、Context 和 Review Gate 均为一等面板。这样能对齐设计文档中目标驱动主入口的定位。
2. 运行时 contract 优先冻结为 Mission / Run / Event / Gate 四类对象，前端先消费 mock 事件流，后端先用假 run 驱动。这能减少 UI 与真实 runtime 接线前的阻塞。
3. Tool Trace 与 Linked Context 分区展示，不把所有状态混进消息流。这样可保持诊断能力和工作台可读性。
4. Review Gate 采用显式暂停/继续模型，而不是在聊天中隐式插入审批提示。这样更符合高风险动作需要人工确认的设计原则。
5. 最终接入 Hermes/Pi runtime 时保留已有 contract，不让真实运行时改写前端页面结构。这样前期 mock 阶段的工作不会因为 runtime 接入被大面积返工。
6. Agent 工具调用必须经过 `AgentToolRegistry`，工具内部复用后端 application service；Agent 不直接读取数据库、不调用 repository、不拥有员工工作台私有业务逻辑。

## Risks / Trade-offs

- [前端先行会与真实 runtime 字段不一致] → 先冻结最小 run/event contract，再要求 runtime adapter 向该 contract 对齐。
- [消息流过载影响工作台可读性] → 把 Plan、Trace、Context、Gate 拆为独立面板。
- [工具调用链过深导致模块早期阻塞] → 开发阶段允许 mock tool result，真实工具接线放到模块最后。
- [与员工工作台上下文耦合不清] → 先定义 workbench context 输入形态，再逐步接到真实页面对象。

## Migration Plan

1. 用 mock message 和 mock event stream 实现 Agent Copilot UI。
2. 固化 Mission、Run、Event、Gate 与 linked entity contract。
3. 实现最小后端协议与 fake run provider。
4. 在模块尾部接入真实 Pi/Hermes runtime adapter 与业务工具。
5. 在跨模块联调 change 中验证 Agent 与员工工作台、Review、真实工具的联动。

## Completion Gate

- Mission 输入、消息流、Plan、Trace、Context、Evidence、Review Gate、暂停/继续能用 mock event stream 完整演示。
- Mission、Run、Event、Gate、linked entity 和 evidence contract 已冻结，并有 fixture 支撑。
- fake run provider 与真实 runtime adapter 使用同一事件 contract。
- Agent 工具只通过 `AgentToolRegistry` 调用后端 application service。
- 真实 runtime 未完成时，本模块可声明“Agent UI 与 fake run 已完成，不阻塞”；真实工具联调必须等待 `backend-business-foundation` 完成 AgentToolRegistry 与对应业务 service。

## Open Questions

- 第一版是否采用 sidecar 为唯一形态，还是同时交付 bubble。
- 第一批真实工具最小集合包含哪些能力。
- Pi/Hermes adapter 采用恢复同一 run 还是 continuation run 作为默认继续策略。
