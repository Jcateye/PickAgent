/** 单个 SKU 在某次活动模拟中的准入结论表（存储模型） */
export interface ActivitySimulationResultRecord {
  /** 主键 */
  id: string;

  /** 模拟运行 ID */
  simulation_run_id: string;

  /** 活动规则集 ID */
  activity_rule_set_id: string;

  /** SKU 档案 ID */
  sku_profile_id: string;

  /** 关联采集快照 ID */
  snapshot_id: string | null;

  /** 关联健康诊断 ID */
  diagnosis_id: string | null;

  /** 活动上下文准入状态 */
  eligibility_status: string;

  /** 准入评分，0 到 100 */
  eligibility_score: number | null;

  /** 未通过规则 JSON */
  failed_rules_json: Record<string, unknown>;

  /** 修复计划 JSON */
  repair_plan_json: Record<string, unknown>;

  /** 人工 Review 信息 JSON */
  manual_review_json: Record<string, unknown>;

  /** 证据链 JSON */
  evidence_json: Record<string, unknown>;

  /** 创建时间 */
  created_at: string;
}
