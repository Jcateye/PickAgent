/** 报告版本表，保存报告章节、证据快照和导出产物引用（领域模型） */
export interface ReportVersion {
  /** 主键 */
  id: string;

  /** 报告 ID */
  reportId: string;

  /** 版本号 */
  version: number;

  /** 版本状态 */
  status: string;

  /** 报告章节 JSON */
  sectionsJson: Record<string, unknown>;

  /** 证据引用 JSON */
  evidenceRefsJson: Record<string, unknown>;

  /** 导出产物 JSON */
  exportArtifactsJson: Record<string, unknown>;

  /** 创建人 */
  createdBy: string | null;

  /** 创建时间 */
  createdAt: string;
}
