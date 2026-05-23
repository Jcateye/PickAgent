/** Agent Context Link列表查询条件 */
export interface AgentContextLinkQueryDto {
  /** 主键 */
  id?: string;

  /** Agent Mission ID */
  missionId?: string | null;

  /** Agent Run ID */
  runId?: string | null;

  /** 来源类型 */
  sourceType?: string;

  /** 来源 ID */
  sourceId?: string | null;

  /** 关联实体类型 */
  entityType?: string;

  /** 关联实体 ID */
  entityId?: string;

  /** 关联对象显示名称 */
  label?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "missionId" | "runId" | "sourceType" | "sourceId" | "entityType" | "entityId" | "label" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
