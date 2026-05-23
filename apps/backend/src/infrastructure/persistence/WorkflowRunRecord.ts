/** 工作流运行审计表（存储模型） */
export interface WorkflowRunRecord {
  /** 主键 */
  id: string;

  /** 工作流类型 */
  workflow_type: string;

  /** 运行状态 */
  status: string;

  /** 业务对象类型 */
  subject_type: string | null;

  /** 业务对象 ID */
  subject_id: string | null;

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
