import type { ConnectorRunCrudService } from "../../application/services/ConnectorRunCrudService";
import type { CreateConnectorRunRequestDto } from "../dto/CreateConnectorRunRequestDto";
import type { UpdateConnectorRunRequestDto } from "../dto/UpdateConnectorRunRequestDto";
import type { ConnectorRunQueryDto } from "../dto/ConnectorRunQueryDto";
import type { ConnectorRunResponseDto } from "../dto/ConnectorRunResponseDto";

/** 数据源采集运行表，记录连接器最近采集运行、行数、质量分、告警和 Workflow 引用控制器骨架 */
export class ConnectorRunController {
  constructor(private readonly service: ConnectorRunCrudService) {}
  async list(query: ConnectorRunQueryDto): Promise<{ items: ConnectorRunResponseDto[]; page: number; pageSize: number; total: number }> { return this.service.list(query); }
  async detail(id: string): Promise<ConnectorRunResponseDto | null> { return this.service.getById(id); }
  async create(payload: CreateConnectorRunRequestDto): Promise<ConnectorRunResponseDto> { return this.service.create(payload); }
  async update(id: string, payload: UpdateConnectorRunRequestDto): Promise<ConnectorRunResponseDto> { return this.service.update(id, payload); }
  async remove(id: string): Promise<void> { return this.service.remove(id); }
}
