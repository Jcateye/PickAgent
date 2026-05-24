/** 报告中心主对象表，保存报告列表、来源对象、导出状态和最新版本（存储模型） */
export interface ReportRecord {
  /** 主键 */
  id: string;

  /** 报告标题 */
  title: string;

  /** 报告类型 */
  report_type: string;

  /** 报告状态 */
  status: string;

  /** 活动 ID */
  activity_id: string | null;

  /** 工作流运行 ID */
  workflow_run_id: string | null;

  /** 活动模拟运行 ID */
  simulation_run_id: string | null;

  /** 最新版本 ID */
  latest_version_id: string | null;

  /** 导出状态 */
  export_status: string;

  /** 订阅配置 JSON */
  subscription_json: Record<string, unknown>;

  /** 报告摘要 JSON */
  summary_json: Record<string, unknown>;

  /** 创建人 */
  created_by: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
