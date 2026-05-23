import type { WorkflowStepRecord } from "../persistence/WorkflowStepRecord";
import type { CreateWorkflowStepRequestDto } from "../../api/dto/CreateWorkflowStepRequestDto";
import type { UpdateWorkflowStepRequestDto } from "../../api/dto/UpdateWorkflowStepRequestDto";
import type { WorkflowStepQueryDto } from "../../api/dto/WorkflowStepQueryDto";

/** 工作流步骤审计表仓储接口 */
export interface WorkflowStepRepository {
  list(query: WorkflowStepQueryDto): Promise<{ items: WorkflowStepRecord[]; total: number }>;
  getById(id: string): Promise<WorkflowStepRecord | null>;
  create(payload: CreateWorkflowStepRequestDto): Promise<WorkflowStepRecord>;
  update(id: string, payload: UpdateWorkflowStepRequestDto): Promise<WorkflowStepRecord>;
  remove(id: string): Promise<void>;
}
