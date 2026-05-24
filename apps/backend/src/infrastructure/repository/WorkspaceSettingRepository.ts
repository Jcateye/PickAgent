import type { WorkspaceSettingRecord } from "../persistence/WorkspaceSettingRecord";
import type { CreateWorkspaceSettingRequestDto } from "../../api/dto/CreateWorkspaceSettingRequestDto";
import type { UpdateWorkspaceSettingRequestDto } from "../../api/dto/UpdateWorkspaceSettingRequestDto";
import type { WorkspaceSettingQueryDto } from "../../api/dto/WorkspaceSettingQueryDto";

/** 工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置仓储接口 */
export interface WorkspaceSettingRepository {
  list(query: WorkspaceSettingQueryDto): Promise<{ items: WorkspaceSettingRecord[]; total: number }>;
  getById(id: string): Promise<WorkspaceSettingRecord | null>;
  create(payload: CreateWorkspaceSettingRequestDto): Promise<WorkspaceSettingRecord>;
  update(id: string, payload: UpdateWorkspaceSettingRequestDto): Promise<WorkspaceSettingRecord>;
  remove(id: string): Promise<void>;
}
