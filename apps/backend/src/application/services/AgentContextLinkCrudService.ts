import type { AgentContextLinkRepository } from "../../infrastructure/repository/AgentContextLinkRepository";
import { AgentContextLinkMapper } from "../../infrastructure/mappers/AgentContextLinkMapper";
import type { CreateAgentContextLinkRequestDto } from "../../api/dto/CreateAgentContextLinkRequestDto";
import type { UpdateAgentContextLinkRequestDto } from "../../api/dto/UpdateAgentContextLinkRequestDto";
import type { AgentContextLinkQueryDto } from "../../api/dto/AgentContextLinkQueryDto";
import type { AgentContextLinkResponseDto } from "../../api/dto/AgentContextLinkResponseDto";

/** Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照基础 CRUD 服务 */
export class AgentContextLinkCrudService {
  constructor(private readonly repository: AgentContextLinkRepository) {}

  async list(query: AgentContextLinkQueryDto): Promise<{ items: AgentContextLinkResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentContextLinkMapper.toResponseDto(AgentContextLinkMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentContextLinkResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentContextLinkMapper.toResponseDto(AgentContextLinkMapper.toEntity(record));
  }

  async create(payload: CreateAgentContextLinkRequestDto): Promise<AgentContextLinkResponseDto> {
    const created = await this.repository.create(payload);
    return AgentContextLinkMapper.toResponseDto(AgentContextLinkMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentContextLinkRequestDto): Promise<AgentContextLinkResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentContextLinkMapper.toResponseDto(AgentContextLinkMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
