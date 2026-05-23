/** Agent Run Event列表查询条件 */
export interface AgentRunEventQueryDto {
  /** 主键 */
  id?: string;

  /** Agent Run ID */
  runId?: string;

  /** Run 内递增事件序号 */
  sequence?: number;

  /** 事件类型 */
  eventType?: string;

  /** 事件阶段 */
  eventPhase?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "runId" | "sequence" | "eventType" | "eventPhase" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
