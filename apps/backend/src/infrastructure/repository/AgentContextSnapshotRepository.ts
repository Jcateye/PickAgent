import type { AgentContextSnapshotRecord } from "../persistence/AgentContextSnapshotRecord";
import type { CreateAgentContextSnapshotRequestDto } from "../../api/dto/CreateAgentContextSnapshotRequestDto";
import type { UpdateAgentContextSnapshotRequestDto } from "../../api/dto/UpdateAgentContextSnapshotRequestDto";
import type { AgentContextSnapshotQueryDto } from "../../api/dto/AgentContextSnapshotQueryDto";

/** Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要仓储接口 */
export interface AgentContextSnapshotRepository {
  list(query: AgentContextSnapshotQueryDto): Promise<{ items: AgentContextSnapshotRecord[]; total: number }>;
  getById(id: string): Promise<AgentContextSnapshotRecord | null>;
  create(payload: CreateAgentContextSnapshotRequestDto): Promise<AgentContextSnapshotRecord>;
  update(id: string, payload: UpdateAgentContextSnapshotRequestDto): Promise<AgentContextSnapshotRecord>;
  remove(id: string): Promise<void>;
}
