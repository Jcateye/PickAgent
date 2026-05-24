/** Report列表查询条件 */
export interface ReportQueryDto {
  /** 主键 */
  id?: string;

  /** 报告标题 */
  title?: string;

  /** 报告类型 */
  reportType?: string;

  /** 报告状态 */
  status?: string;

  /** 活动 ID */
  activityId?: string | null;

  /** 工作流运行 ID */
  workflowRunId?: string | null;

  /** 活动模拟运行 ID */
  simulationRunId?: string | null;

  /** 最新版本 ID */
  latestVersionId?: string | null;

  /** 导出状态 */
  exportStatus?: string;

  /** 创建人 */
  createdBy?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "title" | "reportType" | "status" | "exportStatus" | "createdBy" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
