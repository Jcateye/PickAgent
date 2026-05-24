/** Activity列表查询条件 */
export interface ActivityQueryDto {
  /** 主键 */
  id?: string;

  /** 活动名称 */
  name?: string;

  /** 电商平台标识 */
  platform?: string | null;

  /** 活动状态 */
  status?: string;

  /** 当前规则集 ID */
  currentRuleSetId?: string | null;

  /** 最新工作流运行 ID */
  latestWorkflowRunId?: string | null;

  /** 活动开始时间 */
  startsAt?: string | null;

  /** 活动结束时间 */
  endsAt?: string | null;

  /** 创建人 */
  createdBy?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "name" | "platform" | "status" | "startsAt" | "endsAt" | "createdBy" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
