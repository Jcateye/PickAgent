import type { ReviewItemCrudService } from "../../application/services/ReviewItemCrudService";
import type { CreateReviewItemRequestDto } from "../dto/CreateReviewItemRequestDto";
import type { UpdateReviewItemRequestDto } from "../dto/UpdateReviewItemRequestDto";
import type { ReviewItemQueryDto } from "../dto/ReviewItemQueryDto";
import type { ReviewItemResponseDto } from "../dto/ReviewItemResponseDto";

/** 人工 Review 审批任务表控制器骨架 */
export class ReviewItemController {
  constructor(private readonly service: ReviewItemCrudService) {}

  async list(query: ReviewItemQueryDto): Promise<{ items: ReviewItemResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<ReviewItemResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateReviewItemRequestDto): Promise<ReviewItemResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateReviewItemRequestDto): Promise<ReviewItemResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
