/** 创建Workflow Run请求 */
export interface CreateWorkflowRunRequestDto {
  /** 工作流类型 */
  workflowType: string;

  /** 运行状态 */
  status?: string;

  /** 业务对象类型 */
  subjectType?: string | null;

  /** 业务对象 ID */
  subjectId?: string | null;

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
