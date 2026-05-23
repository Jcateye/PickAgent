/** Agent 消息表，保存 Copilot 会话消息并支持刷新恢复和历史回看（存储模型） */
export interface AgentMessageRecord {
  /** 主键 */
  id: string;

  /** Agent 会话 ID */
  session_id: string;

  /** Agent Run ID */
  run_id: string | null;

  /** 消息角色 */
  role: string;

  /** 会话内消息序号 */
  order_index: number;

  /** 消息文本内容 */
  content_text: string | null;

  /** 消息结构化内容 JSON */
  content_json: Record<string, unknown>;

  /** 消息状态 */
  status: string;

  /** 父消息 ID */
  parent_id: string | null;

  /** 创建时间 */
  created_at: string;
}
