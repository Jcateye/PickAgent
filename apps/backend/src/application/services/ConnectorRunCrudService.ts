import type { ConnectorRunRepository } from "../../infrastructure/repository/ConnectorRunRepository";
import { ConnectorRunMapper } from "../../infrastructure/mappers/ConnectorRunMapper";
import type { CreateConnectorRunRequestDto } from "../../api/dto/CreateConnectorRunRequestDto";
import type { UpdateConnectorRunRequestDto } from "../../api/dto/UpdateConnectorRunRequestDto";
import type { ConnectorRunQueryDto } from "../../api/dto/ConnectorRunQueryDto";
import type { ConnectorRunResponseDto } from "../../api/dto/ConnectorRunResponseDto";

/** 数据源采集运行表，记录连接器最近采集运行、行数、质量分、告警和 Workflow 引用基础 CRUD 服务 */
export class ConnectorRunCrudService {
  constructor(private readonly repository: ConnectorRunRepository) {}

  async list(query: ConnectorRunQueryDto): Promise<{ items: ConnectorRunResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return { items: result.items.map((item) => ConnectorRunMapper.toResponseDto(ConnectorRunMapper.toEntity(item))), page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: result.total };
  }

  async getById(id: string): Promise<ConnectorRunResponseDto | null> {
    const record = await this.repository.getById(id);
    return record ? ConnectorRunMapper.toResponseDto(ConnectorRunMapper.toEntity(record)) : null;
  }

  async create(payload: CreateConnectorRunRequestDto): Promise<ConnectorRunResponseDto> {
    return ConnectorRunMapper.toResponseDto(ConnectorRunMapper.toEntity(await this.repository.create(payload)));
  }

  async update(id: string, payload: UpdateConnectorRunRequestDto): Promise<ConnectorRunResponseDto> {
    return ConnectorRunMapper.toResponseDto(ConnectorRunMapper.toEntity(await this.repository.update(id, payload)));
  }

  async remove(id: string): Promise<void> { await this.repository.remove(id); }
}
