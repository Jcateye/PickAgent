/** Activity Simulation Run列表查询条件 */
export interface ActivitySimulationRunQueryDto {
  /** 主键 */
  id?: string;

  /** 活动规则集 ID */
  activityRuleSetId?: string;

  /** 运行状态 */
  status?: string;

  /** 运行人 */
  runBy?: string | null;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "activityRuleSetId" | "status" | "runBy" | "startedAt" | "completedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
