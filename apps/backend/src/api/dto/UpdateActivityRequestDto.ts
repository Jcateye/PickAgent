/** 更新Activity请求 */
export interface UpdateActivityRequestDto {
  /** 活动名称 */
  name?: string;

  /** 电商平台标识 */
  platform?: string | null;

  /** 活动状态 */
  status?: string;

  /** 活动范围 JSON */
  scopeJson?: Record<string, unknown>;

  /** 当前规则集 ID */
  currentRuleSetId?: string | null;

  /** 最新工作流运行 ID */
  latestWorkflowRunId?: string | null;

  /** 活动开始时间 */
  startsAt?: string | null;

  /** 活动结束时间 */
  endsAt?: string | null;

  /** 活动摘要 JSON */
  summaryJson?: Record<string, unknown>;

  /** 待确认项 JSON */
  pendingQuestionsJson?: Record<string, unknown>;

  /** 证据引用 JSON */
  evidenceRefsJson?: Record<string, unknown>;

  /** 创建人 */
  createdBy?: string | null;
}
