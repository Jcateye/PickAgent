## ADDED Requirements

### Requirement: Copilot overlay and workbench context closure
Agent Copilot MUST 从独立 `/agent-chat` 页面收敛为 console layout 常驻 Overlay / Sidecar，并 SHALL 通过 `WorkbenchContext`、SSE 和 Review Gate 与当前工作台对象联动。

#### Scenario: Open sidecar with context
- **WHEN** 用户在任意主工作台页面打开 Copilot
- **THEN** sidecar 能读取当前 route、selectedEntity、visibleFilters。

#### Scenario: Stream run events
- **WHEN** Agent run 推送事件
- **THEN** 消息、plan、trace、context link、evidence、review gate 分区持续更新。

#### Scenario: Continue after gate approval
- **WHEN** Review Gate 被批准
- **THEN** 前端显示 continuation run，并能链接到 gate、run trace 和相关 Review item。
