/** Workflow Run列表查询条件 */
export interface WorkflowRunQueryDto {
  /** 主键 */
  id?: string;

  /** 工作流类型 */
  workflowType?: string;

  /** 运行状态 */
  status?: string;

  /** 业务对象类型 */
  subjectType?: string | null;

  /** 业务对象 ID */
  subjectId?: string | null;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "workflowType" | "status" | "subjectType" | "subjectId" | "startedAt" | "completedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
