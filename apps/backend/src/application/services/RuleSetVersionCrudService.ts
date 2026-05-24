import type { RuleSetVersionRepository } from "../../infrastructure/repository/RuleSetVersionRepository";
import { RuleSetVersionMapper } from "../../infrastructure/mappers/RuleSetVersionMapper";
import type { CreateRuleSetVersionRequestDto } from "../../api/dto/CreateRuleSetVersionRequestDto";
import type { UpdateRuleSetVersionRequestDto } from "../../api/dto/UpdateRuleSetVersionRequestDto";
import type { RuleSetVersionQueryDto } from "../../api/dto/RuleSetVersionQueryDto";
import type { RuleSetVersionResponseDto } from "../../api/dto/RuleSetVersionResponseDto";

/** 规则库版本表，保存规则集历史版本、Rule DSL 快照和发布状态基础 CRUD 服务 */
export class RuleSetVersionCrudService {
  constructor(private readonly repository: RuleSetVersionRepository) {}

  async list(query: RuleSetVersionQueryDto): Promise<{ items: RuleSetVersionResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return { items: result.items.map((item) => RuleSetVersionMapper.toResponseDto(RuleSetVersionMapper.toEntity(item))), page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: result.total };
  }

  async getById(id: string): Promise<RuleSetVersionResponseDto | null> {
    const record = await this.repository.getById(id);
    return record ? RuleSetVersionMapper.toResponseDto(RuleSetVersionMapper.toEntity(record)) : null;
  }

  async create(payload: CreateRuleSetVersionRequestDto): Promise<RuleSetVersionResponseDto> {
    return RuleSetVersionMapper.toResponseDto(RuleSetVersionMapper.toEntity(await this.repository.create(payload)));
  }

  async update(id: string, payload: UpdateRuleSetVersionRequestDto): Promise<RuleSetVersionResponseDto> {
    return RuleSetVersionMapper.toResponseDto(RuleSetVersionMapper.toEntity(await this.repository.update(id, payload)));
  }

  async remove(id: string): Promise<void> { await this.repository.remove(id); }
}
