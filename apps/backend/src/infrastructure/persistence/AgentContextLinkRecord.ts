/** Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照（存储模型） */
export interface AgentContextLinkRecord {
  /** 主键 */
  id: string;

  /** Agent Mission ID */
  mission_id: string | null;

  /** Agent Run ID */
  run_id: string | null;

  /** 来源类型 */
  source_type: string;

  /** 来源 ID */
  source_id: string | null;

  /** 关联实体类型 */
  entity_type: string;

  /** 关联实体 ID */
  entity_id: string;

  /** 关联对象显示名称 */
  label: string | null;

  /** 关联原因 */
  reason: string | null;

  /** 前端高亮信息 JSON */
  highlight_json: Record<string, unknown>;

  /** 创建时间 */
  created_at: string;
}
