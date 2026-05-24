/** ConnectorRun响应 */
export interface ConnectorRunResponseDto {
  /** 主键 */
  id: string;

  /** 连接器 ID */
  connectorId: string;

  /** 关联工作流运行 ID */
  workflowRunId: string | null;

  /** 运行状态 */
  status: string;

  /** 采集行数 */
  rowCount: number;

  /** 数据质量分，0 到 100 */
  qualityScore: number | null;

  /** 告警 JSON */
  warningsJson: Record<string, unknown>;

  /** 运行摘要 JSON */
  summaryJson: Record<string, unknown>;

  /** 开始时间 */
  startedAt: string | null;

  /** 完成时间 */
  completedAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
