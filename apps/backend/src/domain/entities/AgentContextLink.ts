/** Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照（领域模型） */
export interface AgentContextLink {
  /** 主键 */
  id: string;

  /** Agent Mission ID */
  missionId: string | null;

  /** Agent Run ID */
  runId: string | null;

  /** 来源类型 */
  sourceType: string;

  /** 来源 ID */
  sourceId: string | null;

  /** 关联实体类型 */
  entityType: string;

  /** 关联实体 ID */
  entityId: string;

  /** 关联对象显示名称 */
  label: string | null;

  /** 关联原因 */
  reason: string | null;

  /** 前端高亮信息 JSON */
  highlightJson: Record<string, unknown>;

  /** 创建时间 */
  createdAt: string;
}
