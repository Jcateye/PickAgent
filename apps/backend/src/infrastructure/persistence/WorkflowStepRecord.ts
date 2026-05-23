/** 工作流步骤审计表（存储模型） */
export interface WorkflowStepRecord {
  /** 主键 */
  id: string;

  /** 工作流运行 ID */
  run_id: string;

  /** 步骤编码 */
  step_key: string;

  /** 步骤名称 */
  step_name: string;

  /** 步骤状态 */
  status: string;

  /** 输入 JSON */
  input_json: Record<string, unknown>;

  /** 输出 JSON */
  output_json: Record<string, unknown>;

  /** 错误信息 */
  error_message: string | null;

  /** 开始时间 */
  started_at: string | null;

  /** 完成时间 */
  completed_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
