import type { ActivitySimulationResultRecord } from "../persistence/ActivitySimulationResultRecord";
import type { CreateActivitySimulationResultRequestDto } from "../../api/dto/CreateActivitySimulationResultRequestDto";
import type { UpdateActivitySimulationResultRequestDto } from "../../api/dto/UpdateActivitySimulationResultRequestDto";
import type { ActivitySimulationResultQueryDto } from "../../api/dto/ActivitySimulationResultQueryDto";

/** 单个 SKU 在某次活动模拟中的准入结论表仓储接口 */
export interface ActivitySimulationResultRepository {
  list(query: ActivitySimulationResultQueryDto): Promise<{ items: ActivitySimulationResultRecord[]; total: number }>;
  getById(id: string): Promise<ActivitySimulationResultRecord | null>;
  create(payload: CreateActivitySimulationResultRequestDto): Promise<ActivitySimulationResultRecord>;
  update(id: string, payload: UpdateActivitySimulationResultRequestDto): Promise<ActivitySimulationResultRecord>;
  remove(id: string): Promise<void>;
}
