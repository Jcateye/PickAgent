/** Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用（存储模型） */
export interface AgentToolCallRecord {
  /** 主键 */
  id: string;

  /** Agent Run ID */
  run_id: string;

  /** Pi 或 SDK 侧工具调用 ID */
  external_tool_call_id: string | null;

  /** 关联 WorkflowStep ID */
  workflow_step_id: string | null;

  /** 工具名称 */
  tool_name: string;

  /** 工具调用状态 */
  status: string;

  /** 风险等级 */
  risk_level: string;

  /** Review 策略 */
  review_policy: string;

  /** 工具输入 JSON */
  input_json: Record<string, unknown>;

  /** 工具输出 JSON */
  output_json: Record<string, unknown>;

  /** 证据引用 JSON */
  evidence_refs_json: Record<string, unknown>;

  /** 错误信息 */
  error_message: string | null;

  /** 阻断原因 */
  blocked_reason: string | null;

  /** 开始时间 */
  started_at: string | null;

  /** 完成时间 */
  completed_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
