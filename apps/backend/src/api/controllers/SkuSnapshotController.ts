import type { SkuSnapshotCrudService } from "../../application/services/SkuSnapshotCrudService";
import type { CreateSkuSnapshotRequestDto } from "../dto/CreateSkuSnapshotRequestDto";
import type { UpdateSkuSnapshotRequestDto } from "../dto/UpdateSkuSnapshotRequestDto";
import type { SkuSnapshotQueryDto } from "../dto/SkuSnapshotQueryDto";
import type { SkuSnapshotResponseDto } from "../dto/SkuSnapshotResponseDto";

/** SKU 采集事实快照表控制器骨架 */
export class SkuSnapshotController {
  constructor(private readonly service: SkuSnapshotCrudService) {}

  async list(query: SkuSnapshotQueryDto): Promise<{ items: SkuSnapshotResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<SkuSnapshotResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateSkuSnapshotRequestDto): Promise<SkuSnapshotResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateSkuSnapshotRequestDto): Promise<SkuSnapshotResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
