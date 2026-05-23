import type { ActivitySimulationResultCrudService } from "../../application/services/ActivitySimulationResultCrudService";
import type { CreateActivitySimulationResultRequestDto } from "../dto/CreateActivitySimulationResultRequestDto";
import type { UpdateActivitySimulationResultRequestDto } from "../dto/UpdateActivitySimulationResultRequestDto";
import type { ActivitySimulationResultQueryDto } from "../dto/ActivitySimulationResultQueryDto";
import type { ActivitySimulationResultResponseDto } from "../dto/ActivitySimulationResultResponseDto";

/** 单个 SKU 在某次活动模拟中的准入结论表控制器骨架 */
export class ActivitySimulationResultController {
  constructor(private readonly service: ActivitySimulationResultCrudService) {}

  async list(query: ActivitySimulationResultQueryDto): Promise<{ items: ActivitySimulationResultResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<ActivitySimulationResultResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateActivitySimulationResultRequestDto): Promise<ActivitySimulationResultResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateActivitySimulationResultRequestDto): Promise<ActivitySimulationResultResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
