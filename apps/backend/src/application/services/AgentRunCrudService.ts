import type { AgentRunRepository } from "../../infrastructure/repository/AgentRunRepository";
import { AgentRunMapper } from "../../infrastructure/mappers/AgentRunMapper";
import type { CreateAgentRunRequestDto } from "../../api/dto/CreateAgentRunRequestDto";
import type { UpdateAgentRunRequestDto } from "../../api/dto/UpdateAgentRunRequestDto";
import type { AgentRunQueryDto } from "../../api/dto/AgentRunQueryDto";
import type { AgentRunResponseDto } from "../../api/dto/AgentRunResponseDto";

/** Agent Run 表，保存 Pi 单次运行、模型信息、状态和 WorkflowRun 关联基础 CRUD 服务 */
export class AgentRunCrudService {
  constructor(private readonly repository: AgentRunRepository) {}

  async list(query: AgentRunQueryDto): Promise<{ items: AgentRunResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentRunMapper.toResponseDto(AgentRunMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentRunResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentRunMapper.toResponseDto(AgentRunMapper.toEntity(record));
  }

  async create(payload: CreateAgentRunRequestDto): Promise<AgentRunResponseDto> {
    const created = await this.repository.create(payload);
    return AgentRunMapper.toResponseDto(AgentRunMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentRunRequestDto): Promise<AgentRunResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentRunMapper.toResponseDto(AgentRunMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
