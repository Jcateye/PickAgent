import type { WorkflowStepCrudService } from "../../application/services/WorkflowStepCrudService";
import type { CreateWorkflowStepRequestDto } from "../dto/CreateWorkflowStepRequestDto";
import type { UpdateWorkflowStepRequestDto } from "../dto/UpdateWorkflowStepRequestDto";
import type { WorkflowStepQueryDto } from "../dto/WorkflowStepQueryDto";
import type { WorkflowStepResponseDto } from "../dto/WorkflowStepResponseDto";

/** 工作流步骤审计表控制器骨架 */
export class WorkflowStepController {
  constructor(private readonly service: WorkflowStepCrudService) {}

  async list(query: WorkflowStepQueryDto): Promise<{ items: WorkflowStepResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<WorkflowStepResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateWorkflowStepRequestDto): Promise<WorkflowStepResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateWorkflowStepRequestDto): Promise<WorkflowStepResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
