/** SKU 当前状态读模型表，供 Dashboard、SKU List、Chat summary 和 Report summary 查询（存储模型） */
export interface CurrentSkuProjectionRecord {
  /** SKU 档案 ID，同时作为主键 */
  sku_profile_id: string;

  /** 最新采集快照 ID */
  latest_snapshot_id: string | null;

  /** 最新健康诊断 ID */
  latest_diagnosis_id: string | null;

  /** 当前长期健康状态 */
  health_status: string;

  /** 当前健康分，0 到 100 */
  health_score: number;

  /** 当前数据质量分，0 到 100 */
  data_quality_score: number;

  /** 顶部问题摘要 JSON */
  top_issues_json: Record<string, unknown>;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
