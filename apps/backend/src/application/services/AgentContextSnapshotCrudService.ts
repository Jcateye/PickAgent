import type { AgentContextSnapshotRepository } from "../../infrastructure/repository/AgentContextSnapshotRepository";
import { AgentContextSnapshotMapper } from "../../infrastructure/mappers/AgentContextSnapshotMapper";
import type { CreateAgentContextSnapshotRequestDto } from "../../api/dto/CreateAgentContextSnapshotRequestDto";
import type { UpdateAgentContextSnapshotRequestDto } from "../../api/dto/UpdateAgentContextSnapshotRequestDto";
import type { AgentContextSnapshotQueryDto } from "../../api/dto/AgentContextSnapshotQueryDto";
import type { AgentContextSnapshotResponseDto } from "../../api/dto/AgentContextSnapshotResponseDto";

/** Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要基础 CRUD 服务 */
export class AgentContextSnapshotCrudService {
  constructor(private readonly repository: AgentContextSnapshotRepository) {}

  async list(query: AgentContextSnapshotQueryDto): Promise<{ items: AgentContextSnapshotResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentContextSnapshotMapper.toResponseDto(AgentContextSnapshotMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentContextSnapshotResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentContextSnapshotMapper.toResponseDto(AgentContextSnapshotMapper.toEntity(record));
  }

  async create(payload: CreateAgentContextSnapshotRequestDto): Promise<AgentContextSnapshotResponseDto> {
    const created = await this.repository.create(payload);
    return AgentContextSnapshotMapper.toResponseDto(AgentContextSnapshotMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentContextSnapshotRequestDto): Promise<AgentContextSnapshotResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentContextSnapshotMapper.toResponseDto(AgentContextSnapshotMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
