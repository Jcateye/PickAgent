import type { ConnectorRepository } from "../../infrastructure/repository/ConnectorRepository";
import { ConnectorMapper } from "../../infrastructure/mappers/ConnectorMapper";
import type { CreateConnectorRequestDto } from "../../api/dto/CreateConnectorRequestDto";
import type { UpdateConnectorRequestDto } from "../../api/dto/UpdateConnectorRequestDto";
import type { ConnectorQueryDto } from "../../api/dto/ConnectorQueryDto";
import type { ConnectorResponseDto } from "../../api/dto/ConnectorResponseDto";

/** 数据连接器表，记录插件、平台 API、报表导入等采集来源基础 CRUD 服务 */
export class ConnectorCrudService {
  constructor(private readonly repository: ConnectorRepository) {}

  async list(query: ConnectorQueryDto): Promise<{ items: ConnectorResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => ConnectorMapper.toResponseDto(ConnectorMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<ConnectorResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return ConnectorMapper.toResponseDto(ConnectorMapper.toEntity(record));
  }

  async create(payload: CreateConnectorRequestDto): Promise<ConnectorResponseDto> {
    const created = await this.repository.create(payload);
    return ConnectorMapper.toResponseDto(ConnectorMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateConnectorRequestDto): Promise<ConnectorResponseDto> {
    const updated = await this.repository.update(id, payload);
    return ConnectorMapper.toResponseDto(ConnectorMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
