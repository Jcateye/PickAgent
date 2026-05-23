import type { AgentMission } from "../../domain/entities/AgentMission";
import type { AgentMissionRecord } from "../persistence/AgentMissionRecord";
import type { AgentMissionResponseDto } from "../../api/dto/AgentMissionResponseDto";

/** Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态映射器 */
export const AgentMissionMapper = {
  toEntity(record: AgentMissionRecord): AgentMission {
    return {
      id: record.id,
      sessionId: record.session_id,
      missionType: record.mission_type,
      objective: record.objective,
      autonomyLevel: record.autonomy_level,
      status: record.status,
      sourceSurface: record.source_surface,
      subjectType: record.subject_type,
      subjectId: record.subject_id,
      constraintsJson: record.constraints_json,
      workbenchContextJson: record.workbench_context_json,
      planJson: record.plan_json,
      nextActionsJson: record.next_actions_json,
      createdBy: record.created_by,
      completedAt: record.completed_at,
      canceledAt: record.canceled_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: AgentMission): AgentMissionResponseDto {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      missionType: entity.missionType,
      objective: entity.objective,
      autonomyLevel: entity.autonomyLevel,
      status: entity.status,
      sourceSurface: entity.sourceSurface,
      subjectType: entity.subjectType,
      subjectId: entity.subjectId,
      constraintsJson: entity.constraintsJson,
      workbenchContextJson: entity.workbenchContextJson,
      planJson: entity.planJson,
      nextActionsJson: entity.nextActionsJson,
      createdBy: entity.createdBy,
      completedAt: entity.completedAt,
      canceledAt: entity.canceledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
