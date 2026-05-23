## ADDED Requirements

### Requirement: Review decision and report snapshot closure
Review / Reports MUST 共用后端持久化状态和 evidence summary，并 SHALL 修复 Reports SSR / hydration 不稳定问题。

#### Scenario: Persist review decision
- **WHEN** 用户批准、驳回或修改 Review item
- **THEN** 刷新页面后决策状态仍保留。

#### Scenario: Stable report hydration
- **WHEN** Reports 首屏渲染
- **THEN** SSR 文本和客户端 hydration 文本一致。

#### Scenario: Trace evidence summary
- **WHEN** 用户查看 evidence summary
- **THEN** 每条 evidence 可以定位到 source object、rule、simulation result、review item、workflow step 或 agent tool call。
