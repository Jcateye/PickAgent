import type { Connector } from "../../domain/entities/Connector";
import type { ConnectorRecord } from "../persistence/ConnectorRecord";
import type { ConnectorResponseDto } from "../../api/dto/ConnectorResponseDto";

/** 数据连接器表，记录插件、平台 API、报表导入等采集来源映射器 */
export const ConnectorMapper = {
  toEntity(record: ConnectorRecord): Connector {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      kind: record.kind,
      platform: record.platform,
      configJson: record.config_json,
      status: record.status,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: Connector): ConnectorResponseDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      kind: entity.kind,
      platform: entity.platform,
      configJson: entity.configJson,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
