import type { Report } from "../../domain/entities/Report";
import type { ReportRecord } from "../persistence/ReportRecord";
import type { ReportResponseDto } from "../../api/dto/ReportResponseDto";

/** 报告中心主对象表，保存报告列表、来源对象、导出状态和最新版本映射器 */
export const ReportMapper = {
  toEntity(record: ReportRecord): Report {
    return {
      id: record.id,
      title: record.title,
      reportType: record.report_type,
      status: record.status,
      activityId: record.activity_id,
      workflowRunId: record.workflow_run_id,
      simulationRunId: record.simulation_run_id,
      latestVersionId: record.latest_version_id,
      exportStatus: record.export_status,
      subscriptionJson: record.subscription_json,
      summaryJson: record.summary_json,
      createdBy: record.created_by,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: Report): ReportResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      reportType: entity.reportType,
      status: entity.status,
      activityId: entity.activityId,
      workflowRunId: entity.workflowRunId,
      simulationRunId: entity.simulationRunId,
      latestVersionId: entity.latestVersionId,
      exportStatus: entity.exportStatus,
      subscriptionJson: entity.subscriptionJson,
      summaryJson: entity.summaryJson,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
