/** Agent Session列表查询条件 */
export interface AgentSessionQueryDto {
  /** 主键 */
  id?: string;

  /** 前端或渠道侧会话键 */
  sessionKey?: string;

  /** 用户 ID */
  userId?: string | null;

  /** 来源界面 */
  surface?: string;

  /** Pi 内部 session key */
  piSessionKey?: string | null;

  /** 会话标题 */
  title?: string | null;

  /** 会话状态 */
  status?: string;

  /** 最近活跃时间 */
  lastActiveAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "sessionKey" | "userId" | "surface" | "piSessionKey" | "title" | "status" | "lastActiveAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
