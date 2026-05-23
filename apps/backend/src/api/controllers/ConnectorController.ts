import type { ConnectorCrudService } from "../../application/services/ConnectorCrudService";
import type { CreateConnectorRequestDto } from "../dto/CreateConnectorRequestDto";
import type { UpdateConnectorRequestDto } from "../dto/UpdateConnectorRequestDto";
import type { ConnectorQueryDto } from "../dto/ConnectorQueryDto";
import type { ConnectorResponseDto } from "../dto/ConnectorResponseDto";

/** 数据连接器表，记录插件、平台 API、报表导入等采集来源控制器骨架 */
export class ConnectorController {
  constructor(private readonly service: ConnectorCrudService) {}

  async list(query: ConnectorQueryDto): Promise<{ items: ConnectorResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<ConnectorResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateConnectorRequestDto): Promise<ConnectorResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateConnectorRequestDto): Promise<ConnectorResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
