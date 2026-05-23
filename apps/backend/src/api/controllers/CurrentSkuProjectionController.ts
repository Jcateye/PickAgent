import type { CurrentSkuProjectionCrudService } from "../../application/services/CurrentSkuProjectionCrudService";
import type { CreateCurrentSkuProjectionRequestDto } from "../dto/CreateCurrentSkuProjectionRequestDto";
import type { UpdateCurrentSkuProjectionRequestDto } from "../dto/UpdateCurrentSkuProjectionRequestDto";
import type { CurrentSkuProjectionQueryDto } from "../dto/CurrentSkuProjectionQueryDto";
import type { CurrentSkuProjectionResponseDto } from "../dto/CurrentSkuProjectionResponseDto";

/** SKU 当前状态读模型表，供 Dashboard、SKU List、Chat summary 和 Report summary 查询控制器骨架 */
export class CurrentSkuProjectionController {
  constructor(private readonly service: CurrentSkuProjectionCrudService) {}

  async list(query: CurrentSkuProjectionQueryDto): Promise<{ items: CurrentSkuProjectionResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<CurrentSkuProjectionResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateCurrentSkuProjectionRequestDto): Promise<CurrentSkuProjectionResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateCurrentSkuProjectionRequestDto): Promise<CurrentSkuProjectionResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
