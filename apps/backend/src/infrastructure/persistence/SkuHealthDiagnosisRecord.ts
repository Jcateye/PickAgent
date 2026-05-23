/** SKU 日常健康诊断结论表（存储模型） */
export interface SkuHealthDiagnosisRecord {
  /** 主键 */
  id: string;

  /** SKU 档案 ID */
  sku_profile_id: string;

  /** 关联采集快照 ID */
  snapshot_id: string | null;

  /** 长期健康状态 */
  health_status: string;

  /** 健康分，0 到 100 */
  health_score: number;

  /** 数据质量分，0 到 100 */
  data_quality_score: number;

  /** 问题列表 JSON */
  issues_json: Record<string, unknown>;

  /** 下一步动作 JSON */
  next_actions_json: Record<string, unknown>;

  /** 证据链 JSON */
  evidence_json: Record<string, unknown>;

  /** 诊断时间 */
  diagnosed_at: string;

  /** 创建时间 */
  created_at: string;
}
