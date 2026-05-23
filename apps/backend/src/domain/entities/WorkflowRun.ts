/** 工作流运行审计表（领域模型） */
export interface WorkflowRun {
  /** 主键 */
  id: string;

  /** 工作流类型 */
  workflowType: string;

  /** 运行状态 */
  status: string;

  /** 业务对象类型 */
  subjectType: string | null;

  /** 业务对象 ID */
  subjectId: string | null;

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
