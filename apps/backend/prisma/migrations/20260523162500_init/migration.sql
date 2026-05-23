CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_status') THEN
    CREATE TYPE health_status AS ENUM ('READY', 'REPAIRABLE', 'RISKY', 'BLOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eligibility_status') THEN
    CREATE TYPE eligibility_status AS ENUM ('DIRECT_READY', 'REPAIRABLE_READY', 'MANUAL_REVIEW', 'BLOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_run_status') THEN
    CREATE TYPE workflow_run_status AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_step_status') THEN
    CREATE TYPE workflow_step_status AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  name varchar(128) NOT NULL,
  kind varchar(32) NOT NULL,
  platform varchar(64),
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sku_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key varchar(256) NOT NULL UNIQUE,
  platform varchar(64) NOT NULL,
  store_id varchar(128) NOT NULL,
  external_sku_id varchar(128) NOT NULL,
  product_name varchar(256),
  category varchar(128),
  brand varchar(128),
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_profiles_platform_store_external_key UNIQUE (platform, store_id, external_sku_id)
);

CREATE TABLE IF NOT EXISTS sku_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_profile_id uuid NOT NULL REFERENCES sku_profiles(id) ON DELETE CASCADE,
  connector_id uuid REFERENCES connectors(id) ON DELETE SET NULL,
  source_url text,
  row_index integer,
  collected_at timestamptz NOT NULL DEFAULT now(),
  product_name varchar(256),
  category varchar(128),
  sales30d integer,
  positive_rate numeric(5,4),
  stock integer,
  original_price numeric(12,2),
  lowest_price_30d numeric(12,2),
  campaign_price numeric(12,2),
  joined_brand_day boolean,
  certificate_status varchar(64),
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_snapshots_positive_rate_chk CHECK (positive_rate IS NULL OR (positive_rate >= 0 AND positive_rate <= 1)),
  CONSTRAINT sku_snapshots_sales30d_chk CHECK (sales30d IS NULL OR sales30d >= 0),
  CONSTRAINT sku_snapshots_stock_chk CHECK (stock IS NULL OR stock >= 0)
);

CREATE TABLE IF NOT EXISTS sku_health_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_profile_id uuid NOT NULL REFERENCES sku_profiles(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES sku_snapshots(id) ON DELETE SET NULL,
  health_status health_status NOT NULL,
  health_score integer NOT NULL,
  data_quality_score integer NOT NULL,
  issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagnosed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_health_diagnoses_health_score_chk CHECK (health_score >= 0 AND health_score <= 100),
  CONSTRAINT sku_health_diagnoses_data_quality_score_chk CHECK (data_quality_score >= 0 AND data_quality_score <= 100)
);

CREATE TABLE IF NOT EXISTS current_sku_projections (
  sku_profile_id uuid PRIMARY KEY REFERENCES sku_profiles(id) ON DELETE CASCADE,
  latest_snapshot_id uuid REFERENCES sku_snapshots(id) ON DELETE SET NULL,
  latest_diagnosis_id uuid REFERENCES sku_health_diagnoses(id) ON DELETE SET NULL,
  health_status health_status NOT NULL,
  health_score integer NOT NULL,
  data_quality_score integer NOT NULL,
  top_issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT current_sku_projections_health_score_chk CHECK (health_score >= 0 AND health_score <= 100),
  CONSTRAINT current_sku_projections_data_quality_score_chk CHECK (data_quality_score >= 0 AND data_quality_score <= 100)
);

CREATE TABLE IF NOT EXISTS activity_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  platform varchar(64),
  source_text text NOT NULL,
  rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  parse_model varchar(128),
  parse_confidence numeric(5,4),
  parse_status varchar(32) NOT NULL DEFAULT 'parsed',
  parse_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_rule_sets_parse_confidence_chk CHECK (parse_confidence IS NULL OR (parse_confidence >= 0 AND parse_confidence <= 1))
);

CREATE TABLE IF NOT EXISTS activity_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_rule_set_id uuid NOT NULL REFERENCES activity_rule_sets(id) ON DELETE CASCADE,
  scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'pending',
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_by varchar(128),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_simulation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id uuid NOT NULL REFERENCES activity_simulation_runs(id) ON DELETE CASCADE,
  activity_rule_set_id uuid NOT NULL REFERENCES activity_rule_sets(id) ON DELETE CASCADE,
  sku_profile_id uuid NOT NULL REFERENCES sku_profiles(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES sku_snapshots(id) ON DELETE SET NULL,
  diagnosis_id uuid REFERENCES sku_health_diagnoses(id) ON DELETE SET NULL,
  eligibility_status eligibility_status NOT NULL,
  eligibility_score integer,
  failed_rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  repair_plan_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_review_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_simulation_results_run_sku_key UNIQUE (simulation_run_id, sku_profile_id),
  CONSTRAINT activity_simulation_results_score_chk CHECK (eligibility_score IS NULL OR (eligibility_score >= 0 AND eligibility_score <= 100))
);

CREATE TABLE IF NOT EXISTS review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_profile_id uuid REFERENCES sku_profiles(id) ON DELETE SET NULL,
  snapshot_id uuid REFERENCES sku_snapshots(id) ON DELETE SET NULL,
  diagnosis_id uuid REFERENCES sku_health_diagnoses(id) ON DELETE SET NULL,
  activity_rule_set_id uuid REFERENCES activity_rule_sets(id) ON DELETE SET NULL,
  simulation_result_id uuid REFERENCES activity_simulation_results(id) ON DELETE SET NULL,
  review_type varchar(64) NOT NULL,
  reason_code varchar(96) NOT NULL,
  status review_status NOT NULL DEFAULT 'PENDING',
  question text NOT NULL,
  agent_recommendation text,
  risk_level varchar(32),
  decision varchar(64),
  decision_comment text,
  decision_by varchar(128),
  decided_at timestamptz,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type varchar(96) NOT NULL,
  status workflow_run_status NOT NULL DEFAULT 'QUEUED',
  subject_type varchar(96),
  subject_id varchar(128),
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_key varchar(96) NOT NULL,
  step_name varchar(160) NOT NULL,
  status workflow_step_status NOT NULL DEFAULT 'PENDING',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sku_profiles_platform_store_idx ON sku_profiles(platform, store_id);
CREATE INDEX IF NOT EXISTS sku_snapshots_profile_collected_idx ON sku_snapshots(sku_profile_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS sku_snapshots_connector_collected_idx ON sku_snapshots(connector_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS sku_health_diagnoses_profile_diagnosed_idx ON sku_health_diagnoses(sku_profile_id, diagnosed_at DESC);
CREATE INDEX IF NOT EXISTS current_sku_projections_health_dq_idx ON current_sku_projections(health_status, data_quality_score);
CREATE INDEX IF NOT EXISTS activity_rule_sets_platform_created_idx ON activity_rule_sets(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_simulation_runs_rule_created_idx ON activity_simulation_runs(activity_rule_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_simulation_results_rule_sku_idx ON activity_simulation_results(activity_rule_set_id, sku_profile_id);
CREATE INDEX IF NOT EXISTS activity_simulation_results_run_status_idx ON activity_simulation_results(simulation_run_id, eligibility_status);
CREATE INDEX IF NOT EXISTS review_items_status_type_idx ON review_items(status, review_type);
CREATE INDEX IF NOT EXISTS review_items_sku_created_idx ON review_items(sku_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_runs_type_status_idx ON workflow_runs(workflow_type, status);
CREATE INDEX IF NOT EXISTS workflow_steps_run_idx ON workflow_steps(run_id);
CREATE INDEX IF NOT EXISTS workflow_steps_key_status_idx ON workflow_steps(step_key, status);

DROP TRIGGER IF EXISTS connectors_set_updated_at ON connectors;
CREATE TRIGGER connectors_set_updated_at BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS sku_profiles_set_updated_at ON sku_profiles;
CREATE TRIGGER sku_profiles_set_updated_at BEFORE UPDATE ON sku_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS current_sku_projections_set_updated_at ON current_sku_projections;
CREATE TRIGGER current_sku_projections_set_updated_at BEFORE UPDATE ON current_sku_projections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS activity_rule_sets_set_updated_at ON activity_rule_sets;
CREATE TRIGGER activity_rule_sets_set_updated_at BEFORE UPDATE ON activity_rule_sets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS activity_simulation_runs_set_updated_at ON activity_simulation_runs;
CREATE TRIGGER activity_simulation_runs_set_updated_at BEFORE UPDATE ON activity_simulation_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS review_items_set_updated_at ON review_items;
CREATE TRIGGER review_items_set_updated_at BEFORE UPDATE ON review_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS workflow_runs_set_updated_at ON workflow_runs;
CREATE TRIGGER workflow_runs_set_updated_at BEFORE UPDATE ON workflow_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS workflow_steps_set_updated_at ON workflow_steps;
CREATE TRIGGER workflow_steps_set_updated_at BEFORE UPDATE ON workflow_steps FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE connectors IS '数据连接器表，记录插件、平台 API、报表导入等采集来源';
COMMENT ON COLUMN connectors.id IS '主键';
COMMENT ON COLUMN connectors.code IS '连接器编码';
COMMENT ON COLUMN connectors.name IS '连接器名称';
COMMENT ON COLUMN connectors.kind IS '连接器类型';
COMMENT ON COLUMN connectors.platform IS '电商平台标识';
COMMENT ON COLUMN connectors.config_json IS '连接器配置 JSON';
COMMENT ON COLUMN connectors.status IS '连接器状态';
COMMENT ON COLUMN connectors.created_at IS '创建时间';
COMMENT ON COLUMN connectors.updated_at IS '更新时间';

COMMENT ON TABLE sku_profiles IS '长期 SKU 档案表，承接采集事实、健康结论、活动模拟和 Review';
COMMENT ON COLUMN sku_profiles.id IS '主键';
COMMENT ON COLUMN sku_profiles.canonical_key IS '稳定 SKU 业务键，MVP 采用 platform:store_id:external_sku_id';
COMMENT ON COLUMN sku_profiles.platform IS '电商平台标识';
COMMENT ON COLUMN sku_profiles.store_id IS '店铺或业务主体 ID';
COMMENT ON COLUMN sku_profiles.external_sku_id IS '外部平台 SKU ID';
COMMENT ON COLUMN sku_profiles.product_name IS '商品名称';
COMMENT ON COLUMN sku_profiles.category IS '商品类目';
COMMENT ON COLUMN sku_profiles.brand IS '品牌';
COMMENT ON COLUMN sku_profiles.status IS 'SKU 档案状态';
COMMENT ON COLUMN sku_profiles.created_at IS '创建时间';
COMMENT ON COLUMN sku_profiles.updated_at IS '更新时间';

COMMENT ON TABLE sku_snapshots IS 'SKU 采集事实快照表';
COMMENT ON COLUMN sku_snapshots.id IS '主键';
COMMENT ON COLUMN sku_snapshots.sku_profile_id IS 'SKU 档案 ID';
COMMENT ON COLUMN sku_snapshots.connector_id IS '连接器 ID';
COMMENT ON COLUMN sku_snapshots.source_url IS '来源页面 URL';
COMMENT ON COLUMN sku_snapshots.row_index IS '来源行号';
COMMENT ON COLUMN sku_snapshots.collected_at IS '采集时间';
COMMENT ON COLUMN sku_snapshots.product_name IS '商品名称快照';
COMMENT ON COLUMN sku_snapshots.category IS '商品类目快照';
COMMENT ON COLUMN sku_snapshots.sales30d IS '近 30 天销量';
COMMENT ON COLUMN sku_snapshots.positive_rate IS '好评率，取值范围 0 到 1';
COMMENT ON COLUMN sku_snapshots.stock IS '可售库存';
COMMENT ON COLUMN sku_snapshots.original_price IS '原价';
COMMENT ON COLUMN sku_snapshots.lowest_price_30d IS '近 30 天最低价';
COMMENT ON COLUMN sku_snapshots.campaign_price IS '活动价';
COMMENT ON COLUMN sku_snapshots.joined_brand_day IS '是否已参加品牌日等互斥活动';
COMMENT ON COLUMN sku_snapshots.certificate_status IS '证书状态';
COMMENT ON COLUMN sku_snapshots.raw_json IS '原始采集数据';
COMMENT ON COLUMN sku_snapshots.normalized_json IS '标准化后的字段数据';
COMMENT ON COLUMN sku_snapshots.created_at IS '创建时间';

COMMENT ON TABLE sku_health_diagnoses IS 'SKU 日常健康诊断结论表';
COMMENT ON COLUMN sku_health_diagnoses.id IS '主键';
COMMENT ON COLUMN sku_health_diagnoses.sku_profile_id IS 'SKU 档案 ID';
COMMENT ON COLUMN sku_health_diagnoses.snapshot_id IS '关联采集快照 ID';
COMMENT ON COLUMN sku_health_diagnoses.health_status IS '长期健康状态';
COMMENT ON COLUMN sku_health_diagnoses.health_score IS '健康分，0 到 100';
COMMENT ON COLUMN sku_health_diagnoses.data_quality_score IS '数据质量分，0 到 100';
COMMENT ON COLUMN sku_health_diagnoses.issues_json IS '问题列表 JSON';
COMMENT ON COLUMN sku_health_diagnoses.next_actions_json IS '下一步动作 JSON';
COMMENT ON COLUMN sku_health_diagnoses.evidence_json IS '证据链 JSON';
COMMENT ON COLUMN sku_health_diagnoses.diagnosed_at IS '诊断时间';
COMMENT ON COLUMN sku_health_diagnoses.created_at IS '创建时间';

COMMENT ON TABLE current_sku_projections IS 'SKU 当前状态读模型表，供 Dashboard、SKU List、Chat summary 和 Report summary 查询';
COMMENT ON COLUMN current_sku_projections.sku_profile_id IS 'SKU 档案 ID，同时作为主键';
COMMENT ON COLUMN current_sku_projections.latest_snapshot_id IS '最新采集快照 ID';
COMMENT ON COLUMN current_sku_projections.latest_diagnosis_id IS '最新健康诊断 ID';
COMMENT ON COLUMN current_sku_projections.health_status IS '当前长期健康状态';
COMMENT ON COLUMN current_sku_projections.health_score IS '当前健康分，0 到 100';
COMMENT ON COLUMN current_sku_projections.data_quality_score IS '当前数据质量分，0 到 100';
COMMENT ON COLUMN current_sku_projections.top_issues_json IS '顶部问题摘要 JSON';
COMMENT ON COLUMN current_sku_projections.created_at IS '创建时间';
COMMENT ON COLUMN current_sku_projections.updated_at IS '更新时间';

COMMENT ON TABLE activity_rule_sets IS '活动规则集表，保存规则原文、Rule DSL 和解析元数据';
COMMENT ON COLUMN activity_rule_sets.id IS '主键';
COMMENT ON COLUMN activity_rule_sets.name IS '活动规则集名称';
COMMENT ON COLUMN activity_rule_sets.platform IS '适用平台';
COMMENT ON COLUMN activity_rule_sets.source_text IS '规则原文';
COMMENT ON COLUMN activity_rule_sets.rules_json IS 'Canonical Rule DSL JSON';
COMMENT ON COLUMN activity_rule_sets.parse_model IS '规则解析模型';
COMMENT ON COLUMN activity_rule_sets.parse_confidence IS '规则解析置信度，取值范围 0 到 1';
COMMENT ON COLUMN activity_rule_sets.parse_status IS '规则解析状态';
COMMENT ON COLUMN activity_rule_sets.parse_metadata_json IS '规则解析元数据 JSON';
COMMENT ON COLUMN activity_rule_sets.created_by IS '创建人';
COMMENT ON COLUMN activity_rule_sets.created_at IS '创建时间';
COMMENT ON COLUMN activity_rule_sets.updated_at IS '更新时间';

COMMENT ON TABLE activity_simulation_runs IS '活动准入模拟运行表';
COMMENT ON COLUMN activity_simulation_runs.id IS '主键';
COMMENT ON COLUMN activity_simulation_runs.activity_rule_set_id IS '活动规则集 ID';
COMMENT ON COLUMN activity_simulation_runs.scope_json IS '模拟范围 JSON';
COMMENT ON COLUMN activity_simulation_runs.status IS '运行状态';
COMMENT ON COLUMN activity_simulation_runs.summary_json IS '模拟摘要 JSON';
COMMENT ON COLUMN activity_simulation_runs.run_by IS '运行人';
COMMENT ON COLUMN activity_simulation_runs.started_at IS '开始时间';
COMMENT ON COLUMN activity_simulation_runs.completed_at IS '完成时间';
COMMENT ON COLUMN activity_simulation_runs.created_at IS '创建时间';
COMMENT ON COLUMN activity_simulation_runs.updated_at IS '更新时间';

COMMENT ON TABLE activity_simulation_results IS '单个 SKU 在某次活动模拟中的准入结论表';
COMMENT ON COLUMN activity_simulation_results.id IS '主键';
COMMENT ON COLUMN activity_simulation_results.simulation_run_id IS '模拟运行 ID';
COMMENT ON COLUMN activity_simulation_results.activity_rule_set_id IS '活动规则集 ID';
COMMENT ON COLUMN activity_simulation_results.sku_profile_id IS 'SKU 档案 ID';
COMMENT ON COLUMN activity_simulation_results.snapshot_id IS '关联采集快照 ID';
COMMENT ON COLUMN activity_simulation_results.diagnosis_id IS '关联健康诊断 ID';
COMMENT ON COLUMN activity_simulation_results.eligibility_status IS '活动上下文准入状态';
COMMENT ON COLUMN activity_simulation_results.eligibility_score IS '准入评分，0 到 100';
COMMENT ON COLUMN activity_simulation_results.failed_rules_json IS '未通过规则 JSON';
COMMENT ON COLUMN activity_simulation_results.repair_plan_json IS '修复计划 JSON';
COMMENT ON COLUMN activity_simulation_results.manual_review_json IS '人工 Review 信息 JSON';
COMMENT ON COLUMN activity_simulation_results.evidence_json IS '证据链 JSON';
COMMENT ON COLUMN activity_simulation_results.created_at IS '创建时间';

COMMENT ON TABLE review_items IS '人工 Review 审批任务表';
COMMENT ON COLUMN review_items.id IS '主键';
COMMENT ON COLUMN review_items.sku_profile_id IS 'SKU 档案 ID';
COMMENT ON COLUMN review_items.snapshot_id IS '采集快照 ID';
COMMENT ON COLUMN review_items.diagnosis_id IS '健康诊断 ID';
COMMENT ON COLUMN review_items.activity_rule_set_id IS '活动规则集 ID';
COMMENT ON COLUMN review_items.simulation_result_id IS '活动模拟结果 ID';
COMMENT ON COLUMN review_items.review_type IS 'Review 类型';
COMMENT ON COLUMN review_items.reason_code IS 'Review 原因编码';
COMMENT ON COLUMN review_items.status IS 'Review 状态';
COMMENT ON COLUMN review_items.question IS '需要人工回答的问题';
COMMENT ON COLUMN review_items.agent_recommendation IS 'Agent 建议';
COMMENT ON COLUMN review_items.risk_level IS '风险等级';
COMMENT ON COLUMN review_items.decision IS '人工决策';
COMMENT ON COLUMN review_items.decision_comment IS '人工决策说明';
COMMENT ON COLUMN review_items.decision_by IS '决策人';
COMMENT ON COLUMN review_items.decided_at IS '决策时间';
COMMENT ON COLUMN review_items.evidence_json IS '证据链 JSON';
COMMENT ON COLUMN review_items.created_at IS '创建时间';
COMMENT ON COLUMN review_items.updated_at IS '更新时间';

COMMENT ON TABLE workflow_runs IS '工作流运行审计表';
COMMENT ON COLUMN workflow_runs.id IS '主键';
COMMENT ON COLUMN workflow_runs.workflow_type IS '工作流类型';
COMMENT ON COLUMN workflow_runs.status IS '运行状态';
COMMENT ON COLUMN workflow_runs.subject_type IS '业务对象类型';
COMMENT ON COLUMN workflow_runs.subject_id IS '业务对象 ID';
COMMENT ON COLUMN workflow_runs.input_json IS '输入 JSON';
COMMENT ON COLUMN workflow_runs.output_json IS '输出 JSON';
COMMENT ON COLUMN workflow_runs.error_message IS '错误信息';
COMMENT ON COLUMN workflow_runs.started_at IS '开始时间';
COMMENT ON COLUMN workflow_runs.completed_at IS '完成时间';
COMMENT ON COLUMN workflow_runs.created_at IS '创建时间';
COMMENT ON COLUMN workflow_runs.updated_at IS '更新时间';

COMMENT ON TABLE workflow_steps IS '工作流步骤审计表';
COMMENT ON COLUMN workflow_steps.id IS '主键';
COMMENT ON COLUMN workflow_steps.run_id IS '工作流运行 ID';
COMMENT ON COLUMN workflow_steps.step_key IS '步骤编码';
COMMENT ON COLUMN workflow_steps.step_name IS '步骤名称';
COMMENT ON COLUMN workflow_steps.status IS '步骤状态';
COMMENT ON COLUMN workflow_steps.input_json IS '输入 JSON';
COMMENT ON COLUMN workflow_steps.output_json IS '输出 JSON';
COMMENT ON COLUMN workflow_steps.error_message IS '错误信息';
COMMENT ON COLUMN workflow_steps.started_at IS '开始时间';
COMMENT ON COLUMN workflow_steps.completed_at IS '完成时间';
COMMENT ON COLUMN workflow_steps.created_at IS '创建时间';
COMMENT ON COLUMN workflow_steps.updated_at IS '更新时间';
