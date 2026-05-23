/** Agent Mission列表查询条件 */
export interface AgentMissionQueryDto {
  /** 主键 */
  id?: string;

  /** Agent 会话 ID */
  sessionId?: string;

  /** 任务类型 */
  missionType?: string;

  /** 自治等级 */
  autonomyLevel?: string;

  /** Mission 状态 */
  status?: string;

  /** 来源入口 */
  sourceSurface?: string;

  /** 业务主体类型 */
  subjectType?: string | null;

  /** 业务主体 ID */
  subjectId?: string | null;

  /** 创建人 */
  createdBy?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 取消时间 */
  canceledAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "sessionId" | "missionType" | "autonomyLevel" | "status" | "sourceSurface" | "subjectType" | "subjectId" | "createdBy" | "completedAt" | "canceledAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
