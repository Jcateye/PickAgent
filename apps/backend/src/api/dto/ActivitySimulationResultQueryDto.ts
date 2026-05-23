/** Activity Simulation Result列表查询条件 */
export interface ActivitySimulationResultQueryDto {
  /** 主键 */
  id?: string;

  /** 模拟运行 ID */
  simulationRunId?: string;

  /** 活动规则集 ID */
  activityRuleSetId?: string;

  /** SKU 档案 ID */
  skuProfileId?: string;

  /** 关联采集快照 ID */
  snapshotId?: string | null;

  /** 关联健康诊断 ID */
  diagnosisId?: string | null;

  /** 活动上下文准入状态 */
  eligibilityStatus?: string;

  /** 准入评分，0 到 100 */
  eligibilityScore?: number | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "simulationRunId" | "activityRuleSetId" | "skuProfileId" | "snapshotId" | "diagnosisId" | "eligibilityStatus" | "eligibilityScore" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
