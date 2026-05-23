/** 更新Agent Session请求 */
export interface UpdateAgentSessionRequestDto {
  /** 前端或渠道侧会话键 */
  sessionKey?: string;

  /** 用户 ID */
  userId?: string | null;

  /** 来源界面 */
  surface?: string;

  /** Pi 内部 session key */
  piSessionKey?: string | null;

  /** Pi session 持久化引用 */
  piSessionRef?: string | null;

  /** 会话标题 */
  title?: string | null;

  /** 会话状态 */
  status?: string;

  /** 会话级配置 JSON */
  configJson?: Record<string, unknown>;

  /** 最近活跃时间 */
  lastActiveAt?: string | null;
}
