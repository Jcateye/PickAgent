import type { WorkflowRunCrudService } from "../../application/services/WorkflowRunCrudService";
import type { CreateWorkflowRunRequestDto } from "../dto/CreateWorkflowRunRequestDto";
import type { UpdateWorkflowRunRequestDto } from "../dto/UpdateWorkflowRunRequestDto";
import type { WorkflowRunQueryDto } from "../dto/WorkflowRunQueryDto";
import type { WorkflowRunResponseDto } from "../dto/WorkflowRunResponseDto";

/** 工作流运行审计表控制器骨架 */
export class WorkflowRunController {
  constructor(private readonly service: WorkflowRunCrudService) {}

  async list(query: WorkflowRunQueryDto): Promise<{ items: WorkflowRunResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<WorkflowRunResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateWorkflowRunRequestDto): Promise<WorkflowRunResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateWorkflowRunRequestDto): Promise<WorkflowRunResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
