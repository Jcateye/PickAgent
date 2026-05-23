import type { AgentRunEventCrudService } from "../../application/services/AgentRunEventCrudService";
import type { CreateAgentRunEventRequestDto } from "../dto/CreateAgentRunEventRequestDto";
import type { UpdateAgentRunEventRequestDto } from "../dto/UpdateAgentRunEventRequestDto";
import type { AgentRunEventQueryDto } from "../dto/AgentRunEventQueryDto";
import type { AgentRunEventResponseDto } from "../dto/AgentRunEventResponseDto";

/** Agent 运行事件表，保存 Pi lifecycle、assistant delta、tool event 与 review gate 事件以支持 SSE 重放控制器骨架 */
export class AgentRunEventController {
  constructor(private readonly service: AgentRunEventCrudService) {}

  async list(query: AgentRunEventQueryDto): Promise<{ items: AgentRunEventResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentRunEventResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentRunEventRequestDto): Promise<AgentRunEventResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentRunEventRequestDto): Promise<AgentRunEventResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
