import type { WorkflowStep } from "../../domain/entities/WorkflowStep";
import type { WorkflowStepRecord } from "../persistence/WorkflowStepRecord";
import type { WorkflowStepResponseDto } from "../../api/dto/WorkflowStepResponseDto";

/** 工作流步骤审计表映射器 */
export const WorkflowStepMapper = {
  toEntity(record: WorkflowStepRecord): WorkflowStep {
    return {
      id: record.id,
      runId: record.run_id,
      stepKey: record.step_key,
      stepName: record.step_name,
      status: record.status,
      inputJson: record.input_json,
      outputJson: record.output_json,
      errorMessage: record.error_message,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: WorkflowStep): WorkflowStepResponseDto {
    return {
      id: entity.id,
      runId: entity.runId,
      stepKey: entity.stepKey,
      stepName: entity.stepName,
      status: entity.status,
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
