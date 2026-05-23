/** 创建Current SKU Projection请求 */
export interface CreateCurrentSkuProjectionRequestDto {
  /** 最新采集快照 ID */
  latestSnapshotId?: string | null;

  /** 最新健康诊断 ID */
  latestDiagnosisId?: string | null;

  /** 当前长期健康状态 */
  healthStatus: string;

  /** 当前健康分，0 到 100 */
  healthScore: number;

  /** 当前数据质量分，0 到 100 */
  dataQualityScore: number;

  /** 顶部问题摘要 JSON */
  topIssuesJson?: Record<string, unknown>;
}
