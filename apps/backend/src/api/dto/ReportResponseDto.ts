/** Report响应 */
export interface ReportResponseDto {
  /** 主键 */
  id: string;

  /** 报告标题 */
  title: string;

  /** 报告类型 */
  reportType: string;

  /** 报告状态 */
  status: string;

  /** 活动 ID */
  activityId: string | null;

  /** 工作流运行 ID */
  workflowRunId: string | null;

  /** 活动模拟运行 ID */
  simulationRunId: string | null;

  /** 最新版本 ID */
  latestVersionId: string | null;

  /** 导出状态 */
  exportStatus: string;

  /** 订阅配置 JSON */
  subscriptionJson: Record<string, unknown>;

  /** 报告摘要 JSON */
  summaryJson: Record<string, unknown>;

  /** 创建人 */
  createdBy: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
