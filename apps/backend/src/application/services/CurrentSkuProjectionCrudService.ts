import type { CurrentSkuProjectionRepository } from "../../infrastructure/repository/CurrentSkuProjectionRepository";
import { CurrentSkuProjectionMapper } from "../../infrastructure/mappers/CurrentSkuProjectionMapper";
import type { CreateCurrentSkuProjectionRequestDto } from "../../api/dto/CreateCurrentSkuProjectionRequestDto";
import type { UpdateCurrentSkuProjectionRequestDto } from "../../api/dto/UpdateCurrentSkuProjectionRequestDto";
import type { CurrentSkuProjectionQueryDto } from "../../api/dto/CurrentSkuProjectionQueryDto";
import type { CurrentSkuProjectionResponseDto } from "../../api/dto/CurrentSkuProjectionResponseDto";

/** SKU 当前状态读模型表，供 Dashboard、SKU List、Chat summary 和 Report summary 查询基础 CRUD 服务 */
export class CurrentSkuProjectionCrudService {
  constructor(private readonly repository: CurrentSkuProjectionRepository) {}

  async list(query: CurrentSkuProjectionQueryDto): Promise<{ items: CurrentSkuProjectionResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => CurrentSkuProjectionMapper.toResponseDto(CurrentSkuProjectionMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<CurrentSkuProjectionResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return CurrentSkuProjectionMapper.toResponseDto(CurrentSkuProjectionMapper.toEntity(record));
  }

  async create(payload: CreateCurrentSkuProjectionRequestDto): Promise<CurrentSkuProjectionResponseDto> {
    const created = await this.repository.create(payload);
    return CurrentSkuProjectionMapper.toResponseDto(CurrentSkuProjectionMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateCurrentSkuProjectionRequestDto): Promise<CurrentSkuProjectionResponseDto> {
    const updated = await this.repository.update(id, payload);
    return CurrentSkuProjectionMapper.toResponseDto(CurrentSkuProjectionMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
