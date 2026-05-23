/** SKU Health Diagnosis列表查询条件 */
export interface SkuHealthDiagnosisQueryDto {
  /** 主键 */
  id?: string;

  /** SKU 档案 ID */
  skuProfileId?: string;

  /** 关联采集快照 ID */
  snapshotId?: string | null;

  /** 长期健康状态 */
  healthStatus?: string;

  /** 健康分，0 到 100 */
  healthScore?: number;

  /** 数据质量分，0 到 100 */
  dataQualityScore?: number;

  /** 诊断时间 */
  diagnosedAt?: string;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "skuProfileId" | "snapshotId" | "healthStatus" | "healthScore" | "dataQualityScore" | "diagnosedAt" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
