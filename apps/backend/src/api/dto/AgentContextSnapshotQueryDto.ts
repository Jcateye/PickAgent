/** Agent Context Snapshot列表查询条件 */
export interface AgentContextSnapshotQueryDto {
  /** 主键 */
  id?: string;

  /** Agent Run ID */
  runId?: string;

  /** 上下文 token 估算 */
  tokenEstimate?: number | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "runId" | "tokenEstimate" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
