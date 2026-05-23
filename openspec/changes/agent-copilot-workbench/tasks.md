## 1. Agent workbench contract and layout

- [ ] 1.1 定义 Mission、Run、Event、Gate 和 linked entity 的最小 contract
- [ ] 1.2 实现 Agent Copilot 的消息流、Plan、Trace、Context 和 Review Gate 面板骨架

## 2. Mock-driven workbench flow

- [ ] 2.1 用 mock message 和 mock event stream 打通 Mission 发起与继续流程
- [ ] 2.2 用 mock tool result 打通 Trace、Linked Context 和 Evidence 展示

## 3. Gate and continuation flow

- [ ] 3.1 实现 Review Gate 的暂停、查看和决策交互
- [ ] 3.2 实现 Gate 决策后的继续执行或恢复流程

## 4. Final runtime and tool integration

- [ ] 4.1 接入最小后端协议并校验前后端 contract 一致性
- [ ] 4.2 在模块最后接入真实 Pi/Hermes runtime adapter 与业务工具

## 5. Module readiness gate

- [ ] 5.1 用 mock event fixture 校验 Mission、消息流、Plan、Trace、Context、Evidence、Review Gate、暂停/继续路径
- [ ] 5.2 校验 fake run provider 与真实 runtime adapter 使用同一 Mission / Run / Event / Gate contract
- [ ] 5.3 标记真实工具接入依赖：仅当 `backend-business-foundation` 的 AgentToolRegistry 与对应业务 service 完成后，4.2 才能进入“已完成，不阻塞”
