/** Agent Review Gate列表查询条件 */
export interface AgentReviewGateQueryDto {
  /** 主键 */
  id?: string;

  /** Agent Mission ID */
  missionId?: string;

  /** Agent Run ID */
  runId?: string;

  /** Agent ToolCall ID */
  toolCallId?: string | null;

  /** 关联 ReviewItem ID */
  reviewItemId?: string | null;

  /** Review Gate 状态 */
  status?: string;

  /** Review Gate 原因编码 */
  reasonCode?: string;

  /** 人工决策 */
  decision?: string | null;

  /** 决策人 */
  decidedBy?: string | null;

  /** 决策时间 */
  decidedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "missionId" | "runId" | "toolCallId" | "reviewItemId" | "status" | "reasonCode" | "decision" | "decidedBy" | "decidedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
