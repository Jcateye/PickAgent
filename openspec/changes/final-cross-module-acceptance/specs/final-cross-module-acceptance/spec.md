## ADDED Requirements

### Requirement: Final cross-module acceptance
统一验收 MUST 按固定主链路执行，并 SHALL 为每条链路记录输入、关键 route、关键数据对象、验证证据、结论和回流模块。

#### Scenario: Run fixed L4 order
- **WHEN** L4 验收开始
- **THEN** 按插件到 SKU 健康、活动模拟到 Review / 报告、员工工作台到 Agent、Agent 到真实业务工具的顺序执行。

#### Scenario: Track blockers
- **WHEN** 某条链路阻塞
- **THEN** 验收文档记录阻塞点、所属模块、修复分支和回归状态。

#### Scenario: Publish final decision
- **WHEN** 所有主链路通过
- **THEN** 输出中文验收结论，明确 L4 accepted / P0 blocker / P1 risk。
