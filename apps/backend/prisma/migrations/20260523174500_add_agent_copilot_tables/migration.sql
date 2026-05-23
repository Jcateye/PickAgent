DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_session_status') THEN
    CREATE TYPE agent_session_status AS ENUM ('ACTIVE', 'ARCHIVED', 'CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_mission_status') THEN
    CREATE TYPE agent_mission_status AS ENUM ('DRAFT', 'PLANNING', 'RUNNING', 'WAITING_FOR_DATA', 'WAITING_FOR_REVIEW', 'COMPLETED', 'FAILED', 'CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_run_status') THEN
    CREATE TYPE agent_run_status AS ENUM ('IDLE', 'QUEUED', 'PREPARING_CONTEXT', 'RUNNING', 'STREAMING', 'CALLING_TOOL', 'PAUSED', 'TIMEOUT', 'FAILED', 'DONE', 'CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_message_role') THEN
    CREATE TYPE agent_message_role AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_tool_call_status') THEN
    CREATE TYPE agent_tool_call_status AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED_BY_POLICY', 'WAITING_FOR_APPROVAL', 'CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_review_gate_status') THEN
    CREATE TYPE agent_review_gate_status AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'CANCELED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key varchar(256) NOT NULL UNIQUE,
  user_id varchar(128),
  surface varchar(64) NOT NULL DEFAULT 'console',
  pi_session_key varchar(256),
  pi_session_ref text,
  title varchar(180),
  status agent_session_status NOT NULL DEFAULT 'ACTIVE',
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  mission_type varchar(96) NOT NULL,
  objective text NOT NULL,
  autonomy_level varchar(64) NOT NULL DEFAULT 'L2_REVIEW_GATED_AGENT',
  status agent_mission_status NOT NULL DEFAULT 'DRAFT',
  source_surface varchar(64) NOT NULL DEFAULT 'agent_copilot',
  subject_type varchar(96),
  subject_id varchar(128),
  constraints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  workbench_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by varchar(128),
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES agent_missions(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  pi_run_id varchar(128) UNIQUE,
  workflow_run_id uuid UNIQUE,
  status agent_run_status NOT NULL DEFAULT 'QUEUED',
  model_provider varchar(64),
  model_name varchar(128),
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  timeout_ms integer,
  cancel_requested boolean NOT NULL DEFAULT false,
  usage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  role agent_message_role NOT NULL,
  order_index integer NOT NULL,
  content_text text,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'completed',
  parent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_messages_session_order_key UNIQUE (session_id, order_index)
);

CREATE TABLE IF NOT EXISTS agent_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  event_type varchar(64) NOT NULL,
  event_phase varchar(64),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_run_events_run_sequence_key UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  external_tool_call_id varchar(128),
  workflow_step_id uuid,
  tool_name varchar(96) NOT NULL,
  status agent_tool_call_status NOT NULL DEFAULT 'PENDING',
  risk_level varchar(16) NOT NULL DEFAULT 'L1',
  review_policy varchar(64) NOT NULL DEFAULT 'none',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  blocked_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_tool_calls_run_external_key UNIQUE (run_id, external_tool_call_id)
);

CREATE TABLE IF NOT EXISTS agent_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  workbench_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  stable_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  mission_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  token_estimate integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_context_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES agent_missions(id) ON DELETE CASCADE,
  run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  source_type varchar(64) NOT NULL,
  source_id varchar(128),
  entity_type varchar(96) NOT NULL,
  entity_id varchar(128) NOT NULL,
  label varchar(180),
  reason text,
  highlight_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_review_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES agent_missions(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_call_id uuid REFERENCES agent_tool_calls(id) ON DELETE SET NULL,
  review_item_id uuid,
  status agent_review_gate_status NOT NULL DEFAULT 'PENDING',
  reason_code varchar(96) NOT NULL,
  question text NOT NULL,
  agent_recommendation text,
  risk_if_approved text,
  risk_if_rejected text,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision varchar(64),
  decision_comment text,
  decided_by varchar(128),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_sessions_user_status_idx ON agent_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS agent_sessions_pi_session_key_idx ON agent_sessions(pi_session_key);
CREATE INDEX IF NOT EXISTS agent_missions_session_status_idx ON agent_missions(session_id, status);
CREATE INDEX IF NOT EXISTS agent_missions_subject_idx ON agent_missions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS agent_missions_created_by_idx ON agent_missions(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_mission_created_idx ON agent_runs(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_session_status_idx ON agent_runs(session_id, status);
CREATE INDEX IF NOT EXISTS agent_runs_status_created_idx ON agent_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_messages_run_created_idx ON agent_messages(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_run_events_run_type_idx ON agent_run_events(run_id, event_type);
CREATE INDEX IF NOT EXISTS agent_tool_calls_run_status_idx ON agent_tool_calls(run_id, status);
CREATE INDEX IF NOT EXISTS agent_tool_calls_tool_status_idx ON agent_tool_calls(tool_name, status);
CREATE INDEX IF NOT EXISTS agent_context_snapshots_run_created_idx ON agent_context_snapshots(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_context_links_mission_entity_idx ON agent_context_links(mission_id, entity_type);
CREATE INDEX IF NOT EXISTS agent_context_links_run_entity_idx ON agent_context_links(run_id, entity_type);
CREATE INDEX IF NOT EXISTS agent_context_links_entity_idx ON agent_context_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS agent_review_gates_mission_status_idx ON agent_review_gates(mission_id, status);
CREATE INDEX IF NOT EXISTS agent_review_gates_run_status_idx ON agent_review_gates(run_id, status);
CREATE INDEX IF NOT EXISTS agent_review_gates_review_item_idx ON agent_review_gates(review_item_id);

DROP TRIGGER IF EXISTS agent_sessions_set_updated_at ON agent_sessions;
CREATE TRIGGER agent_sessions_set_updated_at BEFORE UPDATE ON agent_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS agent_missions_set_updated_at ON agent_missions;
CREATE TRIGGER agent_missions_set_updated_at BEFORE UPDATE ON agent_missions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS agent_runs_set_updated_at ON agent_runs;
CREATE TRIGGER agent_runs_set_updated_at BEFORE UPDATE ON agent_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS agent_tool_calls_set_updated_at ON agent_tool_calls;
CREATE TRIGGER agent_tool_calls_set_updated_at BEFORE UPDATE ON agent_tool_calls FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS agent_review_gates_set_updated_at ON agent_review_gates;
CREATE TRIGGER agent_review_gates_set_updated_at BEFORE UPDATE ON agent_review_gates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE agent_sessions IS 'Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session';
COMMENT ON COLUMN agent_sessions.id IS '主键';
COMMENT ON COLUMN agent_sessions.session_key IS '前端或渠道侧会话键';
COMMENT ON COLUMN agent_sessions.user_id IS '用户 ID';
COMMENT ON COLUMN agent_sessions.surface IS '来源界面';
COMMENT ON COLUMN agent_sessions.pi_session_key IS 'Pi 内部 session key';
COMMENT ON COLUMN agent_sessions.pi_session_ref IS 'Pi session 持久化引用';
COMMENT ON COLUMN agent_sessions.title IS '会话标题';
COMMENT ON COLUMN agent_sessions.status IS '会话状态';
COMMENT ON COLUMN agent_sessions.config_json IS '会话级配置 JSON';
COMMENT ON COLUMN agent_sessions.last_active_at IS '最近活跃时间';
COMMENT ON COLUMN agent_sessions.created_at IS '创建时间';
COMMENT ON COLUMN agent_sessions.updated_at IS '更新时间';

COMMENT ON TABLE agent_missions IS 'Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态';
COMMENT ON COLUMN agent_missions.id IS '主键';
COMMENT ON COLUMN agent_missions.session_id IS 'Agent 会话 ID';
COMMENT ON COLUMN agent_missions.mission_type IS '任务类型';
COMMENT ON COLUMN agent_missions.objective IS '用户给出的任务目标';
COMMENT ON COLUMN agent_missions.autonomy_level IS '自治等级';
COMMENT ON COLUMN agent_missions.status IS 'Mission 状态';
COMMENT ON COLUMN agent_missions.source_surface IS '来源入口';
COMMENT ON COLUMN agent_missions.subject_type IS '业务主体类型';
COMMENT ON COLUMN agent_missions.subject_id IS '业务主体 ID';
COMMENT ON COLUMN agent_missions.constraints_json IS '任务约束 JSON';
COMMENT ON COLUMN agent_missions.workbench_context_json IS '创建 Mission 时的工作台上下文 JSON';
COMMENT ON COLUMN agent_missions.plan_json IS '当前计划 JSON';
COMMENT ON COLUMN agent_missions.next_actions_json IS '下一步建议 JSON';
COMMENT ON COLUMN agent_missions.created_by IS '创建人';
COMMENT ON COLUMN agent_missions.completed_at IS '完成时间';
COMMENT ON COLUMN agent_missions.canceled_at IS '取消时间';
COMMENT ON COLUMN agent_missions.created_at IS '创建时间';
COMMENT ON COLUMN agent_missions.updated_at IS '更新时间';

COMMENT ON TABLE agent_runs IS 'Agent Run 表，保存 Pi 单次运行、模型信息、状态和 WorkflowRun 关联';
COMMENT ON COLUMN agent_runs.id IS '主键';
COMMENT ON COLUMN agent_runs.mission_id IS 'Agent Mission ID';
COMMENT ON COLUMN agent_runs.session_id IS 'Agent 会话 ID';
COMMENT ON COLUMN agent_runs.pi_run_id IS 'Pi 运行 ID';
COMMENT ON COLUMN agent_runs.workflow_run_id IS '关联 WorkflowRun ID';
COMMENT ON COLUMN agent_runs.status IS 'Agent Run 状态';
COMMENT ON COLUMN agent_runs.model_provider IS '模型提供方';
COMMENT ON COLUMN agent_runs.model_name IS '模型名称';
COMMENT ON COLUMN agent_runs.input_json IS '输入摘要 JSON';
COMMENT ON COLUMN agent_runs.output_json IS '输出摘要 JSON';
COMMENT ON COLUMN agent_runs.error_message IS '错误信息';
COMMENT ON COLUMN agent_runs.timeout_ms IS '超时时间毫秒';
COMMENT ON COLUMN agent_runs.cancel_requested IS '取消请求标记';
COMMENT ON COLUMN agent_runs.usage_json IS '模型用量 JSON';
COMMENT ON COLUMN agent_runs.metadata_json IS '运行元数据 JSON';
COMMENT ON COLUMN agent_runs.started_at IS '开始时间';
COMMENT ON COLUMN agent_runs.completed_at IS '完成时间';
COMMENT ON COLUMN agent_runs.created_at IS '创建时间';
COMMENT ON COLUMN agent_runs.updated_at IS '更新时间';

COMMENT ON TABLE agent_messages IS 'Agent 消息表，保存 Copilot 会话消息并支持刷新恢复和历史回看';
COMMENT ON COLUMN agent_messages.id IS '主键';
COMMENT ON COLUMN agent_messages.session_id IS 'Agent 会话 ID';
COMMENT ON COLUMN agent_messages.run_id IS 'Agent Run ID';
COMMENT ON COLUMN agent_messages.role IS '消息角色';
COMMENT ON COLUMN agent_messages.order_index IS '会话内消息序号';
COMMENT ON COLUMN agent_messages.content_text IS '消息文本内容';
COMMENT ON COLUMN agent_messages.content_json IS '消息结构化内容 JSON';
COMMENT ON COLUMN agent_messages.status IS '消息状态';
COMMENT ON COLUMN agent_messages.parent_id IS '父消息 ID';
COMMENT ON COLUMN agent_messages.created_at IS '创建时间';

COMMENT ON TABLE agent_run_events IS 'Agent 运行事件表，保存 Pi lifecycle、assistant delta、tool event 与 review gate 事件以支持 SSE 重放';
COMMENT ON COLUMN agent_run_events.id IS '主键';
COMMENT ON COLUMN agent_run_events.run_id IS 'Agent Run ID';
COMMENT ON COLUMN agent_run_events.sequence IS 'Run 内递增事件序号';
COMMENT ON COLUMN agent_run_events.event_type IS '事件类型';
COMMENT ON COLUMN agent_run_events.event_phase IS '事件阶段';
COMMENT ON COLUMN agent_run_events.payload_json IS '事件载荷 JSON';
COMMENT ON COLUMN agent_run_events.created_at IS '创建时间';

COMMENT ON TABLE agent_tool_calls IS 'Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用';
COMMENT ON COLUMN agent_tool_calls.id IS '主键';
COMMENT ON COLUMN agent_tool_calls.run_id IS 'Agent Run ID';
COMMENT ON COLUMN agent_tool_calls.external_tool_call_id IS 'Pi 或 SDK 侧工具调用 ID';
COMMENT ON COLUMN agent_tool_calls.workflow_step_id IS '关联 WorkflowStep ID';
COMMENT ON COLUMN agent_tool_calls.tool_name IS '工具名称';
COMMENT ON COLUMN agent_tool_calls.status IS '工具调用状态';
COMMENT ON COLUMN agent_tool_calls.risk_level IS '风险等级';
COMMENT ON COLUMN agent_tool_calls.review_policy IS 'Review 策略';
COMMENT ON COLUMN agent_tool_calls.input_json IS '工具输入 JSON';
COMMENT ON COLUMN agent_tool_calls.output_json IS '工具输出 JSON';
COMMENT ON COLUMN agent_tool_calls.evidence_refs_json IS '证据引用 JSON';
COMMENT ON COLUMN agent_tool_calls.error_message IS '错误信息';
COMMENT ON COLUMN agent_tool_calls.blocked_reason IS '阻断原因';
COMMENT ON COLUMN agent_tool_calls.started_at IS '开始时间';
COMMENT ON COLUMN agent_tool_calls.completed_at IS '完成时间';
COMMENT ON COLUMN agent_tool_calls.created_at IS '创建时间';
COMMENT ON COLUMN agent_tool_calls.updated_at IS '更新时间';

COMMENT ON TABLE agent_context_snapshots IS 'Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要';
COMMENT ON COLUMN agent_context_snapshots.id IS '主键';
COMMENT ON COLUMN agent_context_snapshots.run_id IS 'Agent Run ID';
COMMENT ON COLUMN agent_context_snapshots.workbench_context_json IS '工作台上下文 JSON';
COMMENT ON COLUMN agent_context_snapshots.stable_context_json IS '稳定系统上下文 JSON';
COMMENT ON COLUMN agent_context_snapshots.mission_context_json IS 'Mission 上下文 JSON';
COMMENT ON COLUMN agent_context_snapshots.evidence_summary_json IS '证据摘要 JSON';
COMMENT ON COLUMN agent_context_snapshots.token_estimate IS '上下文 token 估算';
COMMENT ON COLUMN agent_context_snapshots.created_at IS '创建时间';

COMMENT ON TABLE agent_context_links IS 'Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照';
COMMENT ON COLUMN agent_context_links.id IS '主键';
COMMENT ON COLUMN agent_context_links.mission_id IS 'Agent Mission ID';
COMMENT ON COLUMN agent_context_links.run_id IS 'Agent Run ID';
COMMENT ON COLUMN agent_context_links.source_type IS '来源类型';
COMMENT ON COLUMN agent_context_links.source_id IS '来源 ID';
COMMENT ON COLUMN agent_context_links.entity_type IS '关联实体类型';
COMMENT ON COLUMN agent_context_links.entity_id IS '关联实体 ID';
COMMENT ON COLUMN agent_context_links.label IS '关联对象显示名称';
COMMENT ON COLUMN agent_context_links.reason IS '关联原因';
COMMENT ON COLUMN agent_context_links.highlight_json IS '前端高亮信息 JSON';
COMMENT ON COLUMN agent_context_links.created_at IS '创建时间';

COMMENT ON TABLE agent_review_gates IS 'Agent Review Gate 表，保存 Agent 运行时暂停点、人工确认问题、建议、风险和决策';
COMMENT ON COLUMN agent_review_gates.id IS '主键';
COMMENT ON COLUMN agent_review_gates.mission_id IS 'Agent Mission ID';
COMMENT ON COLUMN agent_review_gates.run_id IS 'Agent Run ID';
COMMENT ON COLUMN agent_review_gates.tool_call_id IS 'Agent ToolCall ID';
COMMENT ON COLUMN agent_review_gates.review_item_id IS '关联 ReviewItem ID';
COMMENT ON COLUMN agent_review_gates.status IS 'Review Gate 状态';
COMMENT ON COLUMN agent_review_gates.reason_code IS 'Review Gate 原因编码';
COMMENT ON COLUMN agent_review_gates.question IS '需要人工确认的问题';
COMMENT ON COLUMN agent_review_gates.agent_recommendation IS 'Agent 建议';
COMMENT ON COLUMN agent_review_gates.risk_if_approved IS '批准后的风险说明';
COMMENT ON COLUMN agent_review_gates.risk_if_rejected IS '拒绝后的风险说明';
COMMENT ON COLUMN agent_review_gates.evidence_refs_json IS '证据引用 JSON';
COMMENT ON COLUMN agent_review_gates.decision IS '人工决策';
COMMENT ON COLUMN agent_review_gates.decision_comment IS '人工决策说明';
COMMENT ON COLUMN agent_review_gates.decided_by IS '决策人';
COMMENT ON COLUMN agent_review_gates.decided_at IS '决策时间';
COMMENT ON COLUMN agent_review_gates.created_at IS '创建时间';
COMMENT ON COLUMN agent_review_gates.updated_at IS '更新时间';
