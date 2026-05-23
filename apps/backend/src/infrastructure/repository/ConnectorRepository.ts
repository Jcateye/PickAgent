import type { ConnectorRecord } from "../persistence/ConnectorRecord";
import type { CreateConnectorRequestDto } from "../../api/dto/CreateConnectorRequestDto";
import type { UpdateConnectorRequestDto } from "../../api/dto/UpdateConnectorRequestDto";
import type { ConnectorQueryDto } from "../../api/dto/ConnectorQueryDto";

/** 数据连接器表，记录插件、平台 API、报表导入等采集来源仓储接口 */
export interface ConnectorRepository {
  list(query: ConnectorQueryDto): Promise<{ items: ConnectorRecord[]; total: number }>;
  getById(id: string): Promise<ConnectorRecord | null>;
  create(payload: CreateConnectorRequestDto): Promise<ConnectorRecord>;
  update(id: string, payload: UpdateConnectorRequestDto): Promise<ConnectorRecord>;
  remove(id: string): Promise<void>;
}
