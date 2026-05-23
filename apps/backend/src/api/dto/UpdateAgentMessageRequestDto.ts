/** 更新Agent Message请求 */
export interface UpdateAgentMessageRequestDto {
  /** Agent 会话 ID */
  sessionId?: string;

  /** Agent Run ID */
  runId?: string | null;

  /** 消息角色 */
  role?: string;

  /** 会话内消息序号 */
  orderIndex?: number;

  /** 消息文本内容 */
  contentText?: string | null;

  /** 消息结构化内容 JSON */
  contentJson?: Record<string, unknown>;

  /** 消息状态 */
  status?: string;

  /** 父消息 ID */
  parentId?: string | null;
}
