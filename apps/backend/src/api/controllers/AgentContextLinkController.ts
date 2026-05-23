import type { AgentContextLinkCrudService } from "../../application/services/AgentContextLinkCrudService";
import type { CreateAgentContextLinkRequestDto } from "../dto/CreateAgentContextLinkRequestDto";
import type { UpdateAgentContextLinkRequestDto } from "../dto/UpdateAgentContextLinkRequestDto";
import type { AgentContextLinkQueryDto } from "../dto/AgentContextLinkQueryDto";
import type { AgentContextLinkResponseDto } from "../dto/AgentContextLinkResponseDto";

/** Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照控制器骨架 */
export class AgentContextLinkController {
  constructor(private readonly service: AgentContextLinkCrudService) {}

  async list(query: AgentContextLinkQueryDto): Promise<{ items: AgentContextLinkResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentContextLinkResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentContextLinkRequestDto): Promise<AgentContextLinkResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentContextLinkRequestDto): Promise<AgentContextLinkResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
