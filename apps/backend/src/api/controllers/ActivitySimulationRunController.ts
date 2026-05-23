import type { ActivitySimulationRunCrudService } from "../../application/services/ActivitySimulationRunCrudService";
import type { CreateActivitySimulationRunRequestDto } from "../dto/CreateActivitySimulationRunRequestDto";
import type { UpdateActivitySimulationRunRequestDto } from "../dto/UpdateActivitySimulationRunRequestDto";
import type { ActivitySimulationRunQueryDto } from "../dto/ActivitySimulationRunQueryDto";
import type { ActivitySimulationRunResponseDto } from "../dto/ActivitySimulationRunResponseDto";

/** 活动准入模拟运行表控制器骨架 */
export class ActivitySimulationRunController {
  constructor(private readonly service: ActivitySimulationRunCrudService) {}

  async list(query: ActivitySimulationRunQueryDto): Promise<{ items: ActivitySimulationRunResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<ActivitySimulationRunResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateActivitySimulationRunRequestDto): Promise<ActivitySimulationRunResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateActivitySimulationRunRequestDto): Promise<ActivitySimulationRunResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
