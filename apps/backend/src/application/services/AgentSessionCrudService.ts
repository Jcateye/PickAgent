import type { AgentSessionRepository } from "../../infrastructure/repository/AgentSessionRepository";
import { AgentSessionMapper } from "../../infrastructure/mappers/AgentSessionMapper";
import type { CreateAgentSessionRequestDto } from "../../api/dto/CreateAgentSessionRequestDto";
import type { UpdateAgentSessionRequestDto } from "../../api/dto/UpdateAgentSessionRequestDto";
import type { AgentSessionQueryDto } from "../../api/dto/AgentSessionQueryDto";
import type { AgentSessionResponseDto } from "../../api/dto/AgentSessionResponseDto";

/** Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session基础 CRUD 服务 */
export class AgentSessionCrudService {
  constructor(private readonly repository: AgentSessionRepository) {}

  async list(query: AgentSessionQueryDto): Promise<{ items: AgentSessionResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentSessionMapper.toResponseDto(AgentSessionMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentSessionResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentSessionMapper.toResponseDto(AgentSessionMapper.toEntity(record));
  }

  async create(payload: CreateAgentSessionRequestDto): Promise<AgentSessionResponseDto> {
    const created = await this.repository.create(payload);
    return AgentSessionMapper.toResponseDto(AgentSessionMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentSessionRequestDto): Promise<AgentSessionResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentSessionMapper.toResponseDto(AgentSessionMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
