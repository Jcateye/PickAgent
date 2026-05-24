/** 活动主对象表，承载活动名称、范围、状态、时间窗、当前规则集和最新运行引用（存储模型） */
export interface ActivityRecord {
  /** 主键 */
  id: string;

  /** 活动名称 */
  name: string;

  /** 电商平台标识 */
  platform: string | null;

  /** 活动状态 */
  status: string;

  /** 活动范围 JSON */
  scope_json: Record<string, unknown>;

  /** 当前规则集 ID */
  current_rule_set_id: string | null;

  /** 最新工作流运行 ID */
  latest_workflow_run_id: string | null;

  /** 活动开始时间 */
  starts_at: string | null;

  /** 活动结束时间 */
  ends_at: string | null;

  /** 活动摘要 JSON */
  summary_json: Record<string, unknown>;

  /** 待确认项 JSON */
  pending_questions_json: Record<string, unknown>;

  /** 证据引用 JSON */
  evidence_refs_json: Record<string, unknown>;

  /** 创建人 */
  created_by: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
