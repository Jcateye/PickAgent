import type { WorkflowRunRecord } from "../persistence/WorkflowRunRecord";
import type { CreateWorkflowRunRequestDto } from "../../api/dto/CreateWorkflowRunRequestDto";
import type { UpdateWorkflowRunRequestDto } from "../../api/dto/UpdateWorkflowRunRequestDto";
import type { WorkflowRunQueryDto } from "../../api/dto/WorkflowRunQueryDto";

/** 工作流运行审计表仓储接口 */
export interface WorkflowRunRepository {
  list(query: WorkflowRunQueryDto): Promise<{ items: WorkflowRunRecord[]; total: number }>;
  getById(id: string): Promise<WorkflowRunRecord | null>;
  create(payload: CreateWorkflowRunRequestDto): Promise<WorkflowRunRecord>;
  update(id: string, payload: UpdateWorkflowRunRequestDto): Promise<WorkflowRunRecord>;
  remove(id: string): Promise<void>;
}
