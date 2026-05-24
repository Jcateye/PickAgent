import type { ConnectorRun } from "../../domain/entities/ConnectorRun";
import type { ConnectorRunRecord } from "../persistence/ConnectorRunRecord";
import type { ConnectorRunResponseDto } from "../../api/dto/ConnectorRunResponseDto";

/** 数据源采集运行表，记录连接器最近采集运行、行数、质量分、告警和 Workflow 引用映射器 */
export const ConnectorRunMapper = {
  toEntity(record: ConnectorRunRecord): ConnectorRun {
    return {
      id: record.id,
      connectorId: record.connector_id,
      workflowRunId: record.workflow_run_id,
      status: record.status,
      rowCount: record.row_count,
      qualityScore: record.quality_score,
      warningsJson: record.warnings_json,
      summaryJson: record.summary_json,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: ConnectorRun): ConnectorRunResponseDto {
    return {
      id: entity.id,
      connectorId: entity.connectorId,
      workflowRunId: entity.workflowRunId,
      status: entity.status,
      rowCount: entity.rowCount,
      qualityScore: entity.qualityScore,
      warningsJson: entity.warningsJson,
      summaryJson: entity.summaryJson,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
