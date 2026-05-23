import type { ReviewItemRepository } from "../../infrastructure/repository/ReviewItemRepository";
import { ReviewItemMapper } from "../../infrastructure/mappers/ReviewItemMapper";
import type { CreateReviewItemRequestDto } from "../../api/dto/CreateReviewItemRequestDto";
import type { UpdateReviewItemRequestDto } from "../../api/dto/UpdateReviewItemRequestDto";
import type { ReviewItemQueryDto } from "../../api/dto/ReviewItemQueryDto";
import type { ReviewItemResponseDto } from "../../api/dto/ReviewItemResponseDto";

/** 人工 Review 审批任务表基础 CRUD 服务 */
export class ReviewItemCrudService {
  constructor(private readonly repository: ReviewItemRepository) {}

  async list(query: ReviewItemQueryDto): Promise<{ items: ReviewItemResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => ReviewItemMapper.toResponseDto(ReviewItemMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<ReviewItemResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return ReviewItemMapper.toResponseDto(ReviewItemMapper.toEntity(record));
  }

  async create(payload: CreateReviewItemRequestDto): Promise<ReviewItemResponseDto> {
    const created = await this.repository.create(payload);
    return ReviewItemMapper.toResponseDto(ReviewItemMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateReviewItemRequestDto): Promise<ReviewItemResponseDto> {
    const updated = await this.repository.update(id, payload);
    return ReviewItemMapper.toResponseDto(ReviewItemMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
