# DB Guidelines

> 本文件定义 SKU Ready Agent 的数据库设计、Prisma 建模、索引策略、迁移纪律与审计要求。目标是让长期 SKU 档案、采集事实、健康结论、活动模拟与 Review 审批边界清晰可追踪。

## 1. 当前建模原则

- 先定义长期主语，再定义快照与派生结果
- 数据库服务于业务边界，不反向决定模块边界
- 高频查询字段做结构化列，不把可筛选条件长期塞进 JSON
- 活动上下文结果不能覆盖日常健康结论
- migration 必须可追踪、可审查、可回滚
- 远程数据库连接与 migration 操作按 `docs/deployment-guidelines.md` 的 Cloudflare Access TCP 方式执行，不在仓库内保存数据库密钥。

## 2. 当前建议的核心实体

### 2.1 长期主语

- `SkuProfile`

职责：

- 长期 SKU 档案主语
- 稳定内部 ID 与 canonical key
- 连接 snapshot、diagnosis、simulation result、review

建议：

- `canonical_key` 先采用 `platform:store_id:external_sku_id`
- MVP 不做复杂跨平台 SKU merge

### 2.2 采集事实

- `Connector`
- `SkuSnapshot`

职责：

- 记录采集来源、原始数据、标准化字段与采集时间

### 2.3 日常健康结论

- `SkuHealthDiagnosis`
- `CurrentSkuProjection`

职责：

- 记录长期健康状态、健康分、数据质量分、issues、next actions
- 提供 Dashboard / SKU List / Chat summary 读模型

### 2.4 活动规则与准入结果

- `ActivityRuleSet`
- `ActivitySimulationRun`
- `ActivitySimulationResult`

职责：

- 保存规则原文、Rule DSL、parse 元数据、simulation scope、结果与 evidence

### 2.5 审批与审计

- `ReviewItem`
- `WorkflowRun`
- `WorkflowStep`
- `AgentEvent`（P1 或演示需要时）

## 3. 状态模型

### 3.1 长期健康状态

- `READY`
- `REPAIRABLE`
- `RISKY`
- `BLOCKED`

### 3.2 活动准入状态

- `DIRECT_READY`
- `REPAIRABLE_READY`
- `MANUAL_REVIEW`
- `BLOCKED`

要求：

- `health_status` 与 `eligibility_status` 必须拆开
- `health_score` 与 `data_quality_score` 是辅助指标，不推翻硬规则状态

## 4. 字段设计原则

### 4.1 必须结构化的高频字段

优先做 typed columns：

- `platform`
- `store_id`
- `external_sku_id`
- `category`
- `sales30d`
- `positive_rate`
- `stock`
- `original_price`
- `lowest_price_30d`
- `campaign_price`
- `joined_brand_day`
- `certificate_status`
- `collected_at`
- `health_status`
- `eligibility_status`
- `data_quality_score`

### 4.2 先放 JSON 的字段

MVP 可先放 JSON：

- `raw_json`
- `issues_json`
- `next_actions_json`
- `rules_json`
- `manual_review_json`
- `scope_json`
- `summary_json`
- `failed_rules_json`
- `repair_plan_json`
- `evidence_json`

## 5. 金额、比例与枚举

- 金额字段使用 `Decimal`，不要用 `Float`
- 比例字段统一口径：建议明确是 `0-1` 还是 `0-100`
- 枚举值应可扩展，避免多个布尔字段拼状态

## 6. Current Projection 原则

`CurrentSkuProjection` 建议进入 P0 正式模型。

作用：

- Dashboard
- SKU List
- Chat summary
- Report summary

最小字段建议：

- `sku_profile_id`
- `latest_snapshot_id`
- `latest_diagnosis_id`
- `health_status`
- `health_score`
- `data_quality_score`
- `top_issues_json`
- `updated_at`

原则：

- Projection 由 ingest / diagnosis 流程统一刷新
- 前端不自己拼 latest snapshot + diagnosis

## 7. Review 建模原则

P0 建议使用 nullable FK 组合：

- `sku_profile_id?`
- `snapshot_id?`
- `diagnosis_id?`
- `activity_rule_set_id?`
- `simulation_result_id?`

配合：

- `review_type`
- `reason_code`
- `status`
- `question`
- `agent_recommendation`
- `decision`
- `decision_comment`
- `decision_by`
- `decided_at`
- `evidence_json`

不建议 P0 只依赖 `targetType/targetId` 作为唯一真相。

## 8. Evidence 原则

P0：

- 先保留 `evidence_json`
- 至少包含：
  - `sourceType`
  - `sourceId`
  - `field`
  - `rawValue`
  - `normalizedValue`
  - `ruleId`
  - `evidenceText`
  - `collectedAt`

P1：

- 如查询和复用需求明显，再拆 `EvidenceRef` 独立表

## 9. 索引建议

首批重点索引：

- `SkuSnapshot(sku_profile_id, collected_at)`
- `SkuHealthDiagnosis(sku_profile_id, created_at)`
- `CurrentSkuProjection(health_status, data_quality_score)` 按查询需要选择
- `ActivitySimulationResult(activity_rule_set_id, sku_profile_id)`
- `ReviewItem(status, review_type)`
- `WorkflowStep(run_id)`

原则：

- 每个索引都要对应明确查询场景
- 不为“以后可能会用”盲目建索引

## 10. 通用字段与审计要求

建议核心表至少考虑：

- `id`
- `created_at`
- `updated_at`
- `created_by` `[按需]`
- `updated_by` `[按需]`
- `deleted_at` `[仅软删表按需]`

此外：

- `WorkflowRun` / `WorkflowStep` 是 P0 最小执行审计
- Review 决策必须有决策人、时间与理由

## 11. 迁移规则

- migration 追加优先，不静默修改已发布 migration
- 高风险结构调整采用两阶段兼容策略：先加、再迁、后切、最后清理
- 金额字段、状态枚举、current projection、review 审批链变更按高风险处理
- 每次 migration 需说明影响范围与回滚思路

## 12. 当前不建议提前做的事

- 不急于把所有 evidence 全部拆表
- 不急于做复杂跨平台 unified SKU merge
- 不急于做过度通用 workflow engine
- 不急于把所有业务条件都抽成 JSON-only 结构

## 13. 禁止事项

- 不得让 `SkuSnapshot` 冒充长期 SKU 档案
- 不得把某次活动库存门槛写死为长期健康标准
- 不得用 `Float` 存价格字段
- 不得让前端自行拼 current state 替代 projection
- 不得只用自然语言字符串表示证据链
