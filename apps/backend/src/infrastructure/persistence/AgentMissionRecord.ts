/** Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态（存储模型） */
export interface AgentMissionRecord {
  /** 主键 */
  id: string;

  /** Agent 会话 ID */
  session_id: string;

  /** 任务类型 */
  mission_type: string;

  /** 用户给出的任务目标 */
  objective: string;

  /** 自治等级 */
  autonomy_level: string;

  /** Mission 状态 */
  status: string;

  /** 来源入口 */
  source_surface: string;

  /** 业务主体类型 */
  subject_type: string | null;

  /** 业务主体 ID */
  subject_id: string | null;

  /** 任务约束 JSON */
  constraints_json: Record<string, unknown>;

  /** 创建 Mission 时的工作台上下文 JSON */
  workbench_context_json: Record<string, unknown>;

  /** 当前计划 JSON */
  plan_json: Record<string, unknown>;

  /** 下一步建议 JSON */
  next_actions_json: Record<string, unknown>;

  /** 创建人 */
  created_by: string | null;

  /** 完成时间 */
  completed_at: string | null;

  /** 取消时间 */
  canceled_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
