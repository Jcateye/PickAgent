CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  platform varchar(64),
  status varchar(32) NOT NULL DEFAULT 'draft',
  scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_rule_set_id uuid REFERENCES activity_rule_sets(id) ON DELETE SET NULL,
  latest_workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_set_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES activity_rule_sets(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft',
  source_text text NOT NULL,
  rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rule_set_versions_rule_version_key UNIQUE (rule_set_id, version)
);

CREATE TABLE IF NOT EXISTS connector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  row_count integer NOT NULL DEFAULT 0,
  quality_score integer,
  warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(180) NOT NULL,
  report_type varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft',
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  simulation_run_id uuid REFERENCES activity_simulation_runs(id) ON DELETE SET NULL,
  latest_version_id uuid,
  export_status varchar(32) NOT NULL DEFAULT 'not_requested',
  subscription_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft',
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  export_artifacts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_versions_report_version_key UNIQUE (report_id, version)
);

CREATE TABLE IF NOT EXISTS workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace varchar(64) NOT NULL,
  setting_key varchar(96) NOT NULL,
  setting_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'active',
  updated_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_settings_namespace_key UNIQUE (namespace, setting_key)
);

CREATE INDEX IF NOT EXISTS activities_platform_status_idx ON activities(platform, status);
CREATE INDEX IF NOT EXISTS activities_current_rule_set_idx ON activities(current_rule_set_id);
CREATE INDEX IF NOT EXISTS activities_time_window_idx ON activities(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS rule_set_versions_rule_status_idx ON rule_set_versions(rule_set_id, status);
CREATE INDEX IF NOT EXISTS connector_runs_connector_created_idx ON connector_runs(connector_id, created_at DESC);
CREATE INDEX IF NOT EXISTS connector_runs_status_created_idx ON connector_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_type_status_idx ON reports(report_type, status);
CREATE INDEX IF NOT EXISTS reports_activity_created_idx ON reports(activity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_workflow_run_idx ON reports(workflow_run_id);
CREATE INDEX IF NOT EXISTS report_versions_report_status_idx ON report_versions(report_id, status);
CREATE INDEX IF NOT EXISTS workspace_settings_namespace_status_idx ON workspace_settings(namespace, status);

DROP TRIGGER IF EXISTS activities_set_updated_at ON activities;
CREATE TRIGGER activities_set_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS connector_runs_set_updated_at ON connector_runs;
CREATE TRIGGER connector_runs_set_updated_at BEFORE UPDATE ON connector_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS workspace_settings_set_updated_at ON workspace_settings;
CREATE TRIGGER workspace_settings_set_updated_at BEFORE UPDATE ON workspace_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE activities IS '活动主对象表，承载活动名称、范围、状态、时间窗、当前规则集和最新运行引用';
COMMENT ON TABLE rule_set_versions IS '规则库版本表，保存规则集历史版本、Rule DSL 快照和发布状态';
COMMENT ON TABLE connector_runs IS '数据源采集运行表，记录连接器最近采集运行、行数、质量分、告警和 Workflow 引用';
COMMENT ON TABLE reports IS '报告中心主对象表，保存报告列表、来源对象、导出状态和最新版本';
COMMENT ON TABLE report_versions IS '报告版本表，保存报告章节、证据快照和导出产物引用';
COMMENT ON TABLE workspace_settings IS '工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置';

INSERT INTO workspace_settings (namespace, setting_key, setting_json, status, updated_by)
VALUES
  ('workspace', 'freshness_thresholds', '{"skuSnapshotHours":24,"connectorRunHours":12,"ruleSetReviewDays":30}'::jsonb, 'active', 'migration:20260524103000'),
  ('workspace', 'review_sla', '{"defaultHours":24,"highRiskHours":4,"blockedHours":2}'::jsonb, 'active', 'migration:20260524103000'),
  ('agent', 'tool_policy', '{"deny":["auto_price_update","auto_activity_signup","auto_product_edit"],"reviewRequiredRiskLevels":["L2","L3"],"productionDevAuthFallback":false}'::jsonb, 'active', 'migration:20260524103000')
ON CONFLICT ON CONSTRAINT workspace_settings_namespace_key DO NOTHING;
