/** 数据源采集运行表，记录连接器最近采集运行、行数、质量分、告警和 Workflow 引用（存储模型） */
export interface ConnectorRunRecord {
  /** 主键 */
  id: string;

  /** 连接器 ID */
  connector_id: string;

  /** 关联工作流运行 ID */
  workflow_run_id: string | null;

  /** 运行状态 */
  status: string;

  /** 采集行数 */
  row_count: number;

  /** 数据质量分，0 到 100 */
  quality_score: number | null;

  /** 告警 JSON */
  warnings_json: Record<string, unknown>;

  /** 运行摘要 JSON */
  summary_json: Record<string, unknown>;

  /** 开始时间 */
  started_at: string | null;

  /** 完成时间 */
  completed_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
