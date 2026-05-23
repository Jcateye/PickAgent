## ADDED Requirements

### Requirement: Final design work allocation freeze
协调层 MUST 将最终设计收敛分工文档拆成可执行 OpenSpec changes，并 SHALL 冻结依赖、边界、并行规则和验收模板。

#### Scenario: Freeze final change set
- **WHEN** Layer 0 开始执行
- **THEN** 仓库存在 10 个 final-* OpenSpec change，且每个 change 包含 proposal、design、tasks 和 spec delta。

#### Scenario: Track execution gates
- **WHEN** 后续 Agent 启动任一 final-* change
- **THEN** 执行跟踪文档说明该 change 所属层级、依赖、并行规则和阻塞判定。
