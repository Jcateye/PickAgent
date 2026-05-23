import type { ActivitySimulationRun } from "../../domain/entities/ActivitySimulationRun";
import type { ActivitySimulationRunRecord } from "../persistence/ActivitySimulationRunRecord";
import type { ActivitySimulationRunResponseDto } from "../../api/dto/ActivitySimulationRunResponseDto";

/** 活动准入模拟运行表映射器 */
export const ActivitySimulationRunMapper = {
  toEntity(record: ActivitySimulationRunRecord): ActivitySimulationRun {
    return {
      id: record.id,
      activityRuleSetId: record.activity_rule_set_id,
      scopeJson: record.scope_json,
      status: record.status,
      summaryJson: record.summary_json,
      runBy: record.run_by,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: ActivitySimulationRun): ActivitySimulationRunResponseDto {
    return {
      id: entity.id,
      activityRuleSetId: entity.activityRuleSetId,
      scopeJson: entity.scopeJson,
      status: entity.status,
      summaryJson: entity.summaryJson,
      runBy: entity.runBy,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
