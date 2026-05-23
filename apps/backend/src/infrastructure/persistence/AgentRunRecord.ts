/** Agent Run 表，保存 Pi 单次运行、模型信息、状态和 WorkflowRun 关联（存储模型） */
export interface AgentRunRecord {
  /** 主键 */
  id: string;

  /** Agent Mission ID */
  mission_id: string;

  /** Agent 会话 ID */
  session_id: string;

  /** Pi 运行 ID */
  pi_run_id: string | null;

  /** 关联 WorkflowRun ID */
  workflow_run_id: string | null;

  /** Agent Run 状态 */
  status: string;

  /** 模型提供方 */
  model_provider: string | null;

  /** 模型名称 */
  model_name: string | null;

  /** 输入摘要 JSON */
  input_json: Record<string, unknown>;

  /** 输出摘要 JSON */
  output_json: Record<string, unknown>;

  /** 错误信息 */
  error_message: string | null;

  /** 超时时间毫秒 */
  timeout_ms: number | null;

  /** 取消请求标记 */
  cancel_requested: boolean;

  /** 模型用量 JSON */
  usage_json: Record<string, unknown>;

  /** 运行元数据 JSON */
  metadata_json: Record<string, unknown>;

  /** 开始时间 */
  started_at: string | null;

  /** 完成时间 */
  completed_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
