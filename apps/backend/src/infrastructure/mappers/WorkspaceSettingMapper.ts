import type { WorkspaceSetting } from "../../domain/entities/WorkspaceSetting";
import type { WorkspaceSettingRecord } from "../persistence/WorkspaceSettingRecord";
import type { WorkspaceSettingResponseDto } from "../../api/dto/WorkspaceSettingResponseDto";

/** 工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置映射器 */
export const WorkspaceSettingMapper = {
  toEntity(record: WorkspaceSettingRecord): WorkspaceSetting {
    return {
      id: record.id,
      namespace: record.namespace,
      settingKey: record.setting_key,
      settingJson: record.setting_json,
      status: record.status,
      updatedBy: record.updated_by,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: WorkspaceSetting): WorkspaceSettingResponseDto {
    return {
      id: entity.id,
      namespace: entity.namespace,
      settingKey: entity.settingKey,
      settingJson: entity.settingJson,
      status: entity.status,
      updatedBy: entity.updatedBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
