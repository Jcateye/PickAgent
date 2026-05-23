/** Workflow Step列表查询条件 */
export interface WorkflowStepQueryDto {
  /** 主键 */
  id?: string;

  /** 工作流运行 ID */
  runId?: string;

  /** 步骤编码 */
  stepKey?: string;

  /** 步骤名称 */
  stepName?: string;

  /** 步骤状态 */
  status?: string;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "runId" | "stepKey" | "stepName" | "status" | "startedAt" | "completedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
