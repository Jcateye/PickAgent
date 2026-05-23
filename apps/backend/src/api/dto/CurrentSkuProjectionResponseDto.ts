/** Current SKU Projection响应对象 */
export interface CurrentSkuProjectionResponseDto {
  /** SKU 档案 ID，同时作为主键 */
  skuProfileId: string;

  /** 最新采集快照 ID */
  latestSnapshotId: string | null;

  /** 最新健康诊断 ID */
  latestDiagnosisId: string | null;

  /** 当前长期健康状态 */
  healthStatus: string;

  /** 当前健康分，0 到 100 */
  healthScore: number;

  /** 当前数据质量分，0 到 100 */
  dataQualityScore: number;

  /** 顶部问题摘要 JSON */
  topIssuesJson: Record<string, unknown>;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
