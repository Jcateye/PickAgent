/** Agent Tool Call列表查询条件 */
export interface AgentToolCallQueryDto {
  /** 主键 */
  id?: string;

  /** Agent Run ID */
  runId?: string;

  /** Pi 或 SDK 侧工具调用 ID */
  externalToolCallId?: string | null;

  /** 关联 WorkflowStep ID */
  workflowStepId?: string | null;

  /** 工具名称 */
  toolName?: string;

  /** 工具调用状态 */
  status?: string;

  /** 风险等级 */
  riskLevel?: string;

  /** Review 策略 */
  reviewPolicy?: string;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "runId" | "externalToolCallId" | "workflowStepId" | "toolName" | "status" | "riskLevel" | "reviewPolicy" | "startedAt" | "completedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
