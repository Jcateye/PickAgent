/** 活动准入模拟运行表（存储模型） */
export interface ActivitySimulationRunRecord {
  /** 主键 */
  id: string;

  /** 活动规则集 ID */
  activity_rule_set_id: string;

  /** 模拟范围 JSON */
  scope_json: Record<string, unknown>;

  /** 运行状态 */
  status: string;

  /** 模拟摘要 JSON */
  summary_json: Record<string, unknown>;

  /** 运行人 */
  run_by: string | null;

  /** 开始时间 */
  started_at: string | null;

  /** 完成时间 */
  completed_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
