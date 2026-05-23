/** Agent Message列表查询条件 */
export interface AgentMessageQueryDto {
  /** 主键 */
  id?: string;

  /** Agent 会话 ID */
  sessionId?: string;

  /** Agent Run ID */
  runId?: string | null;

  /** 消息角色 */
  role?: string;

  /** 会话内消息序号 */
  orderIndex?: number;

  /** 消息状态 */
  status?: string;

  /** 父消息 ID */
  parentId?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "sessionId" | "runId" | "role" | "orderIndex" | "status" | "parentId" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
