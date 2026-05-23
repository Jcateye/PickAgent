import type { SkuProfileCrudService } from "../../application/services/SkuProfileCrudService";
import type { CreateSkuProfileRequestDto } from "../dto/CreateSkuProfileRequestDto";
import type { UpdateSkuProfileRequestDto } from "../dto/UpdateSkuProfileRequestDto";
import type { SkuProfileQueryDto } from "../dto/SkuProfileQueryDto";
import type { SkuProfileResponseDto } from "../dto/SkuProfileResponseDto";

/** 长期 SKU 档案表，承接采集事实、健康结论、活动模拟和 Review控制器骨架 */
export class SkuProfileController {
  constructor(private readonly service: SkuProfileCrudService) {}

  async list(query: SkuProfileQueryDto): Promise<{ items: SkuProfileResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<SkuProfileResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateSkuProfileRequestDto): Promise<SkuProfileResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateSkuProfileRequestDto): Promise<SkuProfileResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
