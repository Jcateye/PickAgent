/** 工作流步骤审计表（领域模型） */
export interface WorkflowStep {
  /** 主键 */
  id: string;

  /** 工作流运行 ID */
  runId: string;

  /** 步骤编码 */
  stepKey: string;

  /** 步骤名称 */
  stepName: string;

  /** 步骤状态 */
  status: string;

  /** 输入 JSON */
  inputJson: Record<string, unknown>;

  /** 输出 JSON */
  outputJson: Record<string, unknown>;

  /** 错误信息 */
  errorMessage: string | null;

  /** 开始时间 */
  startedAt: string | null;

  /** 完成时间 */
  completedAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
