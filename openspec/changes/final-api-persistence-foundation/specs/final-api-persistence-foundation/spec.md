## ADDED Requirements

### Requirement: API route binding and transaction foundation
后端 MUST 把 L4 主链路所需 route 绑定到 application service，并 SHALL 通过 repository / transaction 写入或读取稳定数据，而不是继续依赖内存 runtime 作为主路径。

#### Scenario: Ingest transaction
- **WHEN** 插件提交 ingest payload
- **THEN** `POST /api/ingest` 在单事务内写入 `SkuProfile`、`SkuSnapshot`、`SkuHealthDiagnosis`、`CurrentSkuProjection` 和 workflow audit。

#### Scenario: Stable staff DTOs
- **WHEN** 员工工作台请求 summary/list/detail
- **THEN** API 返回稳定 DTO，且不要求前端拼装底层事实模型。

#### Scenario: Shared persistent services
- **WHEN** 活动模拟、Review decision、Report preview 被调用
- **THEN** 结果来自同一组 application service 和持久化对象。
