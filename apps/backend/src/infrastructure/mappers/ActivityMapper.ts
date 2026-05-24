import type { Activity } from "../../domain/entities/Activity";
import type { ActivityRecord } from "../persistence/ActivityRecord";
import type { ActivityResponseDto } from "../../api/dto/ActivityResponseDto";

/** 活动主对象表，承载活动名称、范围、状态、时间窗、当前规则集和最新运行引用映射器 */
export const ActivityMapper = {
  toEntity(record: ActivityRecord): Activity {
    return {
      id: record.id,
      name: record.name,
      platform: record.platform,
      status: record.status,
      scopeJson: record.scope_json,
      currentRuleSetId: record.current_rule_set_id,
      latestWorkflowRunId: record.latest_workflow_run_id,
      startsAt: record.starts_at,
      endsAt: record.ends_at,
      summaryJson: record.summary_json,
      pendingQuestionsJson: record.pending_questions_json,
      evidenceRefsJson: record.evidence_refs_json,
      createdBy: record.created_by,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: Activity): ActivityResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      platform: entity.platform,
      status: entity.status,
      scopeJson: entity.scopeJson,
      currentRuleSetId: entity.currentRuleSetId,
      latestWorkflowRunId: entity.latestWorkflowRunId,
      startsAt: entity.startsAt,
      endsAt: entity.endsAt,
      summaryJson: entity.summaryJson,
      pendingQuestionsJson: entity.pendingQuestionsJson,
      evidenceRefsJson: entity.evidenceRefsJson,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
