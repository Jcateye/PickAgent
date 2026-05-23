/** 更新Workflow Step请求 */
export interface UpdateWorkflowStepRequestDto {
  /** 工作流运行 ID */
  runId?: string;

  /** 步骤编码 */
  stepKey?: string;

  /** 步骤名称 */
  stepName?: string;

  /** 步骤状态 */
  status?: string;

  /** 输入 JSON */
  inputJson?: Record<string, unknown>;

  /** 输出 JSON */
  outputJson?: Record<string, unknown>;

  /** 错误信息 */
  errorMessage?: string | null;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;
}
