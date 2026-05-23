## ADDED Requirements

### Requirement: Staff health console API closure
员工健康工作台 MUST 默认消费真实 summary/list/detail DTO，并 SHALL 只在开发或接口不可用时使用 mock fallback。

#### Scenario: Dashboard after ingest
- **WHEN** ingest 完成后打开 Dashboard
- **THEN** summary 数量和状态分布能解释本次采集结果。

#### Scenario: Trace SKU detail
- **WHEN** 用户打开 SKU 详情
- **THEN** 页面展示 snapshot、diagnosis、collection risk 和 evidence 来源。

#### Scenario: Explicit fallback
- **WHEN** API 不可用
- **THEN** 页面明确进入 fallback 状态，而不是静默宣告生产闭环完成。
