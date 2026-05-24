/** 更新ReportVersion请求 */
export interface UpdateReportVersionRequestDto {
  /** 报告 ID */
  reportId?: string;

  /** 版本号 */
  version?: number;

  /** 版本状态 */
  status?: string;

  /** 报告章节 JSON */
  sectionsJson?: Record<string, unknown>;

  /** 证据引用 JSON */
  evidenceRefsJson?: Record<string, unknown>;

  /** 导出产物 JSON */
  exportArtifactsJson?: Record<string, unknown>;

  /** 创建人 */
  createdBy?: string | null;
}
