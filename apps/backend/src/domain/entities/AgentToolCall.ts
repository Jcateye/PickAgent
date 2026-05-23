/** Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用（领域模型） */
export interface AgentToolCall {
  /** 主键 */
  id: string;

  /** Agent Run ID */
  runId: string;

  /** Pi 或 SDK 侧工具调用 ID */
  externalToolCallId: string | null;

  /** 关联 WorkflowStep ID */
  workflowStepId: string | null;

  /** 工具名称 */
  toolName: string;

  /** 工具调用状态 */
  status: string;

  /** 风险等级 */
  riskLevel: string;

  /** Review 策略 */
  reviewPolicy: string;

  /** 工具输入 JSON */
  inputJson: Record<string, unknown>;

  /** 工具输出 JSON */
  outputJson: Record<string, unknown>;

  /** 证据引用 JSON */
  evidenceRefsJson: Record<string, unknown>;

  /** 错误信息 */
  errorMessage: string | null;

  /** 阻断原因 */
  blockedReason: string | null;

  /** 开始时间 */
  startedAt: string | null;

  /** 完成时间 */
  completedAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
