/** ConnectorRun列表查询条件 */
export interface ConnectorRunQueryDto {
  /** 主键 */
  id?: string;

  /** 连接器 ID */
  connectorId?: string;

  /** 关联工作流运行 ID */
  workflowRunId?: string | null;

  /** 运行状态 */
  status?: string;

  /** 数据质量分，0 到 100 */
  qualityScore?: number | null;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "status" | "rowCount" | "qualityScore" | "startedAt" | "completedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
