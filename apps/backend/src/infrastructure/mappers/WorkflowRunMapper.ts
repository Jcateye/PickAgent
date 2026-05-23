import type { WorkflowRun } from "../../domain/entities/WorkflowRun";
import type { WorkflowRunRecord } from "../persistence/WorkflowRunRecord";
import type { WorkflowRunResponseDto } from "../../api/dto/WorkflowRunResponseDto";

/** 工作流运行审计表映射器 */
export const WorkflowRunMapper = {
  toEntity(record: WorkflowRunRecord): WorkflowRun {
    return {
      id: record.id,
      workflowType: record.workflow_type,
      status: record.status,
      subjectType: record.subject_type,
      subjectId: record.subject_id,
      inputJson: record.input_json,
      outputJson: record.output_json,
      errorMessage: record.error_message,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: WorkflowRun): WorkflowRunResponseDto {
    return {
      id: entity.id,
      workflowType: entity.workflowType,
      status: entity.status,
      subjectType: entity.subjectType,
      subjectId: entity.subjectId,
      inputJson: entity.inputJson,
      outputJson: entity.outputJson,
      errorMessage: entity.errorMessage,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
