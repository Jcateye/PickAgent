/** 人工 Review 审批任务表（存储模型） */
export interface ReviewItemRecord {
  /** 主键 */
  id: string;

  /** SKU 档案 ID */
  sku_profile_id: string | null;

  /** 采集快照 ID */
  snapshot_id: string | null;

  /** 健康诊断 ID */
  diagnosis_id: string | null;

  /** 活动规则集 ID */
  activity_rule_set_id: string | null;

  /** 活动模拟结果 ID */
  simulation_result_id: string | null;

  /** Review 类型 */
  review_type: string;

  /** Review 原因编码 */
  reason_code: string;

  /** Review 状态 */
  status: string;

  /** 需要人工回答的问题 */
  question: string;

  /** Agent 建议 */
  agent_recommendation: string | null;

  /** 风险等级 */
  risk_level: string | null;

  /** 人工决策 */
  decision: string | null;

  /** 人工决策说明 */
  decision_comment: string | null;

  /** 决策人 */
  decision_by: string | null;

  /** 决策时间 */
  decided_at: string | null;

  /** 证据链 JSON */
  evidence_json: Record<string, unknown>;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
