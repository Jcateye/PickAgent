import type { AgentRunEventRepository } from "../../infrastructure/repository/AgentRunEventRepository";
import { AgentRunEventMapper } from "../../infrastructure/mappers/AgentRunEventMapper";
import type { CreateAgentRunEventRequestDto } from "../../api/dto/CreateAgentRunEventRequestDto";
import type { UpdateAgentRunEventRequestDto } from "../../api/dto/UpdateAgentRunEventRequestDto";
import type { AgentRunEventQueryDto } from "../../api/dto/AgentRunEventQueryDto";
import type { AgentRunEventResponseDto } from "../../api/dto/AgentRunEventResponseDto";

/** Agent 运行事件表，保存 Pi lifecycle、assistant delta、tool event 与 review gate 事件以支持 SSE 重放基础 CRUD 服务 */
export class AgentRunEventCrudService {
  constructor(private readonly repository: AgentRunEventRepository) {}

  async list(query: AgentRunEventQueryDto): Promise<{ items: AgentRunEventResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentRunEventMapper.toResponseDto(AgentRunEventMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentRunEventResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentRunEventMapper.toResponseDto(AgentRunEventMapper.toEntity(record));
  }

  async create(payload: CreateAgentRunEventRequestDto): Promise<AgentRunEventResponseDto> {
    const created = await this.repository.create(payload);
    return AgentRunEventMapper.toResponseDto(AgentRunEventMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentRunEventRequestDto): Promise<AgentRunEventResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentRunEventMapper.toResponseDto(AgentRunEventMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
