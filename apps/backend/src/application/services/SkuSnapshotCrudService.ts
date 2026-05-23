import type { SkuSnapshotRepository } from "../../infrastructure/repository/SkuSnapshotRepository";
import { SkuSnapshotMapper } from "../../infrastructure/mappers/SkuSnapshotMapper";
import type { CreateSkuSnapshotRequestDto } from "../../api/dto/CreateSkuSnapshotRequestDto";
import type { UpdateSkuSnapshotRequestDto } from "../../api/dto/UpdateSkuSnapshotRequestDto";
import type { SkuSnapshotQueryDto } from "../../api/dto/SkuSnapshotQueryDto";
import type { SkuSnapshotResponseDto } from "../../api/dto/SkuSnapshotResponseDto";

/** SKU 采集事实快照表基础 CRUD 服务 */
export class SkuSnapshotCrudService {
  constructor(private readonly repository: SkuSnapshotRepository) {}

  async list(query: SkuSnapshotQueryDto): Promise<{ items: SkuSnapshotResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => SkuSnapshotMapper.toResponseDto(SkuSnapshotMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<SkuSnapshotResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return SkuSnapshotMapper.toResponseDto(SkuSnapshotMapper.toEntity(record));
  }

  async create(payload: CreateSkuSnapshotRequestDto): Promise<SkuSnapshotResponseDto> {
    const created = await this.repository.create(payload);
    return SkuSnapshotMapper.toResponseDto(SkuSnapshotMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateSkuSnapshotRequestDto): Promise<SkuSnapshotResponseDto> {
    const updated = await this.repository.update(id, payload);
    return SkuSnapshotMapper.toResponseDto(SkuSnapshotMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
