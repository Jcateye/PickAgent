import type { AgentMessageRepository } from "../../infrastructure/repository/AgentMessageRepository";
import { AgentMessageMapper } from "../../infrastructure/mappers/AgentMessageMapper";
import type { CreateAgentMessageRequestDto } from "../../api/dto/CreateAgentMessageRequestDto";
import type { UpdateAgentMessageRequestDto } from "../../api/dto/UpdateAgentMessageRequestDto";
import type { AgentMessageQueryDto } from "../../api/dto/AgentMessageQueryDto";
import type { AgentMessageResponseDto } from "../../api/dto/AgentMessageResponseDto";

/** Agent 消息表，保存 Copilot 会话消息并支持刷新恢复和历史回看基础 CRUD 服务 */
export class AgentMessageCrudService {
  constructor(private readonly repository: AgentMessageRepository) {}

  async list(query: AgentMessageQueryDto): Promise<{ items: AgentMessageResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentMessageMapper.toResponseDto(AgentMessageMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentMessageResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentMessageMapper.toResponseDto(AgentMessageMapper.toEntity(record));
  }

  async create(payload: CreateAgentMessageRequestDto): Promise<AgentMessageResponseDto> {
    const created = await this.repository.create(payload);
    return AgentMessageMapper.toResponseDto(AgentMessageMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentMessageRequestDto): Promise<AgentMessageResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentMessageMapper.toResponseDto(AgentMessageMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
