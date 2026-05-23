import type { SkuProfileRepository } from "../../infrastructure/repository/SkuProfileRepository";
import { SkuProfileMapper } from "../../infrastructure/mappers/SkuProfileMapper";
import type { CreateSkuProfileRequestDto } from "../../api/dto/CreateSkuProfileRequestDto";
import type { UpdateSkuProfileRequestDto } from "../../api/dto/UpdateSkuProfileRequestDto";
import type { SkuProfileQueryDto } from "../../api/dto/SkuProfileQueryDto";
import type { SkuProfileResponseDto } from "../../api/dto/SkuProfileResponseDto";

/** 长期 SKU 档案表，承接采集事实、健康结论、活动模拟和 Review基础 CRUD 服务 */
export class SkuProfileCrudService {
  constructor(private readonly repository: SkuProfileRepository) {}

  async list(query: SkuProfileQueryDto): Promise<{ items: SkuProfileResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => SkuProfileMapper.toResponseDto(SkuProfileMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<SkuProfileResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return SkuProfileMapper.toResponseDto(SkuProfileMapper.toEntity(record));
  }

  async create(payload: CreateSkuProfileRequestDto): Promise<SkuProfileResponseDto> {
    const created = await this.repository.create(payload);
    return SkuProfileMapper.toResponseDto(SkuProfileMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateSkuProfileRequestDto): Promise<SkuProfileResponseDto> {
    const updated = await this.repository.update(id, payload);
    return SkuProfileMapper.toResponseDto(SkuProfileMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
