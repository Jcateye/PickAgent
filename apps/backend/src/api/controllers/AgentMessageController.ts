import type { AgentMessageCrudService } from "../../application/services/AgentMessageCrudService";
import type { CreateAgentMessageRequestDto } from "../dto/CreateAgentMessageRequestDto";
import type { UpdateAgentMessageRequestDto } from "../dto/UpdateAgentMessageRequestDto";
import type { AgentMessageQueryDto } from "../dto/AgentMessageQueryDto";
import type { AgentMessageResponseDto } from "../dto/AgentMessageResponseDto";

/** Agent 消息表，保存 Copilot 会话消息并支持刷新恢复和历史回看控制器骨架 */
export class AgentMessageController {
  constructor(private readonly service: AgentMessageCrudService) {}

  async list(query: AgentMessageQueryDto): Promise<{ items: AgentMessageResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentMessageResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentMessageRequestDto): Promise<AgentMessageResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentMessageRequestDto): Promise<AgentMessageResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
