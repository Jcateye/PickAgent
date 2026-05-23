/** Agent Run响应对象 */
export interface AgentRunResponseDto {
  /** 主键 */
  id: string;

  /** Agent Mission ID */
  missionId: string;

  /** Agent 会话 ID */
  sessionId: string;

  /** Pi 运行 ID */
  piRunId: string | null;

  /** 关联 WorkflowRun ID */
  workflowRunId: string | null;

  /** Agent Run 状态 */
  status: string;

  /** 模型提供方 */
  modelProvider: string | null;

  /** 模型名称 */
  modelName: string | null;

  /** 输入摘要 JSON */
  inputJson: Record<string, unknown>;

  /** 输出摘要 JSON */
  outputJson: Record<string, unknown>;

  /** 错误信息 */
  errorMessage: string | null;

  /** 超时时间毫秒 */
  timeoutMs: number | null;

  /** 取消请求标记 */
  cancelRequested: boolean;

  /** 模型用量 JSON */
  usageJson: Record<string, unknown>;

  /** 运行元数据 JSON */
  metadataJson: Record<string, unknown>;

  /** 开始时间 */
  startedAt: string | null;

  /** 完成时间 */
  completedAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
