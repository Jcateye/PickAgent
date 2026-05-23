## ADDED Requirements

### Requirement: Pi runtime and policy POC
Agent runtime MUST 通过最小 Pi adapter 执行低风险业务工具，并 SHALL 对 L2 工具执行 Review Gate 策略，不允许默认高危工具进入业务 Agent。

#### Scenario: Restrict Pi tools
- **WHEN** Pi adapter 启动业务 run
- **THEN** 只能看见 `AgentToolRegistry` 暴露的业务工具。

#### Scenario: Execute low-risk tools
- **WHEN** run 调用 `parseActivityRules`、`simulateActivityReadiness`、`explainDecisionWithEvidence`
- **THEN** 事件写入 EventStore 并通过 SSE 可见。

#### Scenario: Block risky or unknown tools
- **WHEN** run 尝试 L2 工具或未注册工具
- **THEN** 系统创建 Review Gate 或拒绝调用。
