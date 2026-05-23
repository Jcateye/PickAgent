/** Current SKU Projection列表查询条件 */
export interface CurrentSkuProjectionQueryDto {
  /** SKU 档案 ID，同时作为主键 */
  skuProfileId?: string;

  /** 最新采集快照 ID */
  latestSnapshotId?: string | null;

  /** 最新健康诊断 ID */
  latestDiagnosisId?: string | null;

  /** 当前长期健康状态 */
  healthStatus?: string;

  /** 当前健康分，0 到 100 */
  healthScore?: number;

  /** 当前数据质量分，0 到 100 */
  dataQualityScore?: number;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "skuProfileId" | "latestSnapshotId" | "latestDiagnosisId" | "healthStatus" | "healthScore" | "dataQualityScore" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
