/** Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态（领域模型） */
export interface AgentMission {
  /** 主键 */
  id: string;

  /** Agent 会话 ID */
  sessionId: string;

  /** 任务类型 */
  missionType: string;

  /** 用户给出的任务目标 */
  objective: string;

  /** 自治等级 */
  autonomyLevel: string;

  /** Mission 状态 */
  status: string;

  /** 来源入口 */
  sourceSurface: string;

  /** 业务主体类型 */
  subjectType: string | null;

  /** 业务主体 ID */
  subjectId: string | null;

  /** 任务约束 JSON */
  constraintsJson: Record<string, unknown>;

  /** 创建 Mission 时的工作台上下文 JSON */
  workbenchContextJson: Record<string, unknown>;

  /** 当前计划 JSON */
  planJson: Record<string, unknown>;

  /** 下一步建议 JSON */
  nextActionsJson: Record<string, unknown>;

  /** 创建人 */
  createdBy: string | null;

  /** 完成时间 */
  completedAt: string | null;

  /** 取消时间 */
  canceledAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
