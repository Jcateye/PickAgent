import type { ReportVersionRepository } from "../../infrastructure/repository/ReportVersionRepository";
import { ReportVersionMapper } from "../../infrastructure/mappers/ReportVersionMapper";
import type { CreateReportVersionRequestDto } from "../../api/dto/CreateReportVersionRequestDto";
import type { UpdateReportVersionRequestDto } from "../../api/dto/UpdateReportVersionRequestDto";
import type { ReportVersionQueryDto } from "../../api/dto/ReportVersionQueryDto";
import type { ReportVersionResponseDto } from "../../api/dto/ReportVersionResponseDto";

/** 报告版本表，保存报告章节、证据快照和导出产物引用基础 CRUD 服务 */
export class ReportVersionCrudService {
  constructor(private readonly repository: ReportVersionRepository) {}

  async list(query: ReportVersionQueryDto): Promise<{ items: ReportVersionResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return { items: result.items.map((item) => ReportVersionMapper.toResponseDto(ReportVersionMapper.toEntity(item))), page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: result.total };
  }

  async getById(id: string): Promise<ReportVersionResponseDto | null> {
    const record = await this.repository.getById(id);
    return record ? ReportVersionMapper.toResponseDto(ReportVersionMapper.toEntity(record)) : null;
  }

  async create(payload: CreateReportVersionRequestDto): Promise<ReportVersionResponseDto> {
    return ReportVersionMapper.toResponseDto(ReportVersionMapper.toEntity(await this.repository.create(payload)));
  }

  async update(id: string, payload: UpdateReportVersionRequestDto): Promise<ReportVersionResponseDto> {
    return ReportVersionMapper.toResponseDto(ReportVersionMapper.toEntity(await this.repository.update(id, payload)));
  }

  async remove(id: string): Promise<void> { await this.repository.remove(id); }
}
