import type { ActivitySimulationRunRecord } from "../persistence/ActivitySimulationRunRecord";
import type { CreateActivitySimulationRunRequestDto } from "../../api/dto/CreateActivitySimulationRunRequestDto";
import type { UpdateActivitySimulationRunRequestDto } from "../../api/dto/UpdateActivitySimulationRunRequestDto";
import type { ActivitySimulationRunQueryDto } from "../../api/dto/ActivitySimulationRunQueryDto";

/** 活动准入模拟运行表仓储接口 */
export interface ActivitySimulationRunRepository {
  list(query: ActivitySimulationRunQueryDto): Promise<{ items: ActivitySimulationRunRecord[]; total: number }>;
  getById(id: string): Promise<ActivitySimulationRunRecord | null>;
  create(payload: CreateActivitySimulationRunRequestDto): Promise<ActivitySimulationRunRecord>;
  update(id: string, payload: UpdateActivitySimulationRunRequestDto): Promise<ActivitySimulationRunRecord>;
  remove(id: string): Promise<void>;
}
