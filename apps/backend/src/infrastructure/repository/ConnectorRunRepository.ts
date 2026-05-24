import type { ConnectorRunRecord } from "../persistence/ConnectorRunRecord";
import type { CreateConnectorRunRequestDto } from "../../api/dto/CreateConnectorRunRequestDto";
import type { UpdateConnectorRunRequestDto } from "../../api/dto/UpdateConnectorRunRequestDto";
import type { ConnectorRunQueryDto } from "../../api/dto/ConnectorRunQueryDto";

/** 数据源采集运行表，记录连接器最近采集运行、行数、质量分、告警和 Workflow 引用仓储接口 */
export interface ConnectorRunRepository {
  list(query: ConnectorRunQueryDto): Promise<{ items: ConnectorRunRecord[]; total: number }>;
  getById(id: string): Promise<ConnectorRunRecord | null>;
  create(payload: CreateConnectorRunRequestDto): Promise<ConnectorRunRecord>;
  update(id: string, payload: UpdateConnectorRunRequestDto): Promise<ConnectorRunRecord>;
  remove(id: string): Promise<void>;
}
