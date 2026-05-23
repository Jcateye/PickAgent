/** Agent Run列表查询条件 */
export interface AgentRunQueryDto {
  /** 主键 */
  id?: string;

  /** Agent Mission ID */
  missionId?: string;

  /** Agent 会话 ID */
  sessionId?: string;

  /** Pi 运行 ID */
  piRunId?: string | null;

  /** 关联 WorkflowRun ID */
  workflowRunId?: string | null;

  /** Agent Run 状态 */
  status?: string;

  /** 模型提供方 */
  modelProvider?: string | null;

  /** 模型名称 */
  modelName?: string | null;

  /** 超时时间毫秒 */
  timeoutMs?: number | null;

  /** 取消请求标记 */
  cancelRequested?: boolean;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "missionId" | "sessionId" | "piRunId" | "workflowRunId" | "status" | "modelProvider" | "modelName" | "timeoutMs" | "cancelRequested" | "startedAt" | "completedAt" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
