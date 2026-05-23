## ADDED Requirements

### Requirement: Browser extension ingest validation
插件 MUST 在用户当前抖店页面上下文中完成受控采集和 ingest 提交，并 SHALL 不读取、不复制、不保存 Cookie、token 或平台敏感凭据。

#### Scenario: Preview controlled collection
- **WHEN** 用户在抖店商品列表页触发采集
- **THEN** 插件展示字段映射预览、分页范围、采集层风险和提交确认。

#### Scenario: Submit ingest
- **WHEN** 用户提交采集
- **THEN** 插件调用真实 `POST /api/ingest` 并展示 ingest receipt。

#### Scenario: Classify missing source fields
- **WHEN** sale price、类目名称或状态字典缺失
- **THEN** 插件只标记采集风险，不生成业务健康结论。
