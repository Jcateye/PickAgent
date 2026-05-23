/** Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session（存储模型） */
export interface AgentSessionRecord {
  /** 主键 */
  id: string;

  /** 前端或渠道侧会话键 */
  session_key: string;

  /** 用户 ID */
  user_id: string | null;

  /** 来源界面 */
  surface: string;

  /** Pi 内部 session key */
  pi_session_key: string | null;

  /** Pi session 持久化引用 */
  pi_session_ref: string | null;

  /** 会话标题 */
  title: string | null;

  /** 会话状态 */
  status: string;

  /** 会话级配置 JSON */
  config_json: Record<string, unknown>;

  /** 最近活跃时间 */
  last_active_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
