import type { AgentRun } from "../../domain/entities/AgentRun";
import type { AgentRunRecord } from "../persistence/AgentRunRecord";
import type { AgentRunResponseDto } from "../../api/dto/AgentRunResponseDto";

/** Agent Run 表，保存 Pi 单次运行、模型信息、状态和 WorkflowRun 关联映射器 */
export const AgentRunMapper = {
  toEntity(record: AgentRunRecord): AgentRun {
    return {
      id: record.id,
      missionId: record.mission_id,
      sessionId: record.session_id,
      piRunId: record.pi_run_id,
      workflowRunId: record.workflow_run_id,
      status: record.status,
      modelProvider: record.model_provider,
      modelName: record.model_name,
      inputJson: record.input_json,
      outputJson: record.output_json,
      errorMessage: record.error_message,
      timeoutMs: record.timeout_ms,
      cancelRequested: record.cancel_requested,
      usageJson: record.usage_json,
      metadataJson: record.metadata_json,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: AgentRun): AgentRunResponseDto {
    return {
      id: entity.id,
      missionId: entity.missionId,
      sessionId: entity.sessionId,
      piRunId: entity.piRunId,
      workflowRunId: entity.workflowRunId,
      status: entity.status,
      modelProvider: entity.modelProvider,
      modelName: entity.modelName,
      inputJson: entity.inputJson,
      outputJson: entity.outputJson,
      errorMessage: entity.errorMessage,
      timeoutMs: entity.timeoutMs,
      cancelRequested: entity.cancelRequested,
      usageJson: entity.usageJson,
      metadataJson: entity.metadataJson,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
