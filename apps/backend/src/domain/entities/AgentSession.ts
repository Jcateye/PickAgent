/** Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session（领域模型） */
export interface AgentSession {
  /** 主键 */
  id: string;

  /** 前端或渠道侧会话键 */
  sessionKey: string;

  /** 用户 ID */
  userId: string | null;

  /** 来源界面 */
  surface: string;

  /** Pi 内部 session key */
  piSessionKey: string | null;

  /** Pi session 持久化引用 */
  piSessionRef: string | null;

  /** 会话标题 */
  title: string | null;

  /** 会话状态 */
  status: string;

  /** 会话级配置 JSON */
  configJson: Record<string, unknown>;

  /** 最近活跃时间 */
  lastActiveAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
