## ADDED Requirements

### Requirement: Activity simulation persistent closure
活动工作台 MUST 通过真实 parse/simulation API 生成活动上下文准入结论，并 SHALL 将 `ActivitySimulationResult` 与长期健康状态分开。

#### Scenario: Parse rule DSL
- **WHEN** 用户提交活动规则文本
- **THEN** 后端返回经 Zod 校验的 Rule DSL、parse status、confidence 和错误信息。

#### Scenario: Run simulation with refs
- **WHEN** 用户运行模拟
- **THEN** 结果区分 `DIRECT_READY`、`REPAIRABLE_READY`、`MANUAL_REVIEW`、`BLOCKED`，并带 rule/evidence refs。

#### Scenario: Run what-if safely
- **WHEN** 用户运行 what-if
- **THEN** 系统返回对比结果，不修改真实 SKU 档案。
