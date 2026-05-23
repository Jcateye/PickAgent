import type { ActivityRuleSet } from "../../domain/entities/ActivityRuleSet";
import type { ActivityRuleSetRecord } from "../persistence/ActivityRuleSetRecord";
import type { ActivityRuleSetResponseDto } from "../../api/dto/ActivityRuleSetResponseDto";

/** 活动规则集表，保存规则原文、Rule DSL 和解析元数据映射器 */
export const ActivityRuleSetMapper = {
  toEntity(record: ActivityRuleSetRecord): ActivityRuleSet {
    return {
      id: record.id,
      name: record.name,
      platform: record.platform,
      sourceText: record.source_text,
      rulesJson: record.rules_json,
      parseModel: record.parse_model,
      parseConfidence: record.parse_confidence,
      parseStatus: record.parse_status,
      parseMetadataJson: record.parse_metadata_json,
      createdBy: record.created_by,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: ActivityRuleSet): ActivityRuleSetResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      platform: entity.platform,
      sourceText: entity.sourceText,
      rulesJson: entity.rulesJson,
      parseModel: entity.parseModel,
      parseConfidence: entity.parseConfidence,
      parseStatus: entity.parseStatus,
      parseMetadataJson: entity.parseMetadataJson,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
