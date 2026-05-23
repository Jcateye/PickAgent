/** Review Item列表查询条件 */
export interface ReviewItemQueryDto {
  /** 主键 */
  id?: string;

  /** SKU 档案 ID */
  skuProfileId?: string | null;

  /** 采集快照 ID */
  snapshotId?: string | null;

  /** 健康诊断 ID */
  diagnosisId?: string | null;

  /** 活动规则集 ID */
  activityRuleSetId?: string | null;

  /** 活动模拟结果 ID */
  simulationResultId?: string | null;

  /** Review 类型 */
  reviewType?: string;

  /** Review 原因编码 */
  reasonCode?: string;

  /** Review 状态 */
  status?: string;

  /** 风险等级 */
  riskLevel?: string | null;

  /** 人工决策 */
  decision?: string | null;

  /** 决策人 */
  decisionBy?: string | null;

  /** 决策时间 */
  decidedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "skuProfileId" | "snapshotId" | "diagnosisId" | "activityRuleSetId" | "simulationResultId" | "reviewType" | "reasonCode" | "status" | "riskLevel" | "decision" | "decisionBy" | "decidedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
