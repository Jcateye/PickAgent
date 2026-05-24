import type { RuleSetVersion } from "../../domain/entities/RuleSetVersion";
import type { RuleSetVersionRecord } from "../persistence/RuleSetVersionRecord";
import type { RuleSetVersionResponseDto } from "../../api/dto/RuleSetVersionResponseDto";

/** 规则库版本表，保存规则集历史版本、Rule DSL 快照和发布状态映射器 */
export const RuleSetVersionMapper = {
  toEntity(record: RuleSetVersionRecord): RuleSetVersion {
    return {
      id: record.id,
      ruleSetId: record.rule_set_id,
      version: record.version,
      status: record.status,
      sourceText: record.source_text,
      rulesJson: record.rules_json,
      requiredFieldsJson: record.required_fields_json,
      confirmationsJson: record.confirmations_json,
      metadataJson: record.metadata_json,
      createdBy: record.created_by,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: RuleSetVersion): RuleSetVersionResponseDto {
    return {
      id: entity.id,
      ruleSetId: entity.ruleSetId,
      version: entity.version,
      status: entity.status,
      sourceText: entity.sourceText,
      rulesJson: entity.rulesJson,
      requiredFieldsJson: entity.requiredFieldsJson,
      confirmationsJson: entity.confirmationsJson,
      metadataJson: entity.metadataJson,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
    };
  },
};
