import type { ReportRepository } from "../../infrastructure/repository/ReportRepository";
import { ReportMapper } from "../../infrastructure/mappers/ReportMapper";
import type { CreateReportRequestDto } from "../../api/dto/CreateReportRequestDto";
import type { UpdateReportRequestDto } from "../../api/dto/UpdateReportRequestDto";
import type { ReportQueryDto } from "../../api/dto/ReportQueryDto";
import type { ReportResponseDto } from "../../api/dto/ReportResponseDto";

/** 报告中心主对象表，保存报告列表、来源对象、导出状态和最新版本基础 CRUD 服务 */
export class ReportCrudService {
  constructor(private readonly repository: ReportRepository) {}

  async list(query: ReportQueryDto): Promise<{ items: ReportResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return { items: result.items.map((item) => ReportMapper.toResponseDto(ReportMapper.toEntity(item))), page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: result.total };
  }

  async getById(id: string): Promise<ReportResponseDto | null> {
    const record = await this.repository.getById(id);
    return record ? ReportMapper.toResponseDto(ReportMapper.toEntity(record)) : null;
  }

  async create(payload: CreateReportRequestDto): Promise<ReportResponseDto> {
    return ReportMapper.toResponseDto(ReportMapper.toEntity(await this.repository.create(payload)));
  }

  async update(id: string, payload: UpdateReportRequestDto): Promise<ReportResponseDto> {
    return ReportMapper.toResponseDto(ReportMapper.toEntity(await this.repository.update(id, payload)));
  }

  async remove(id: string): Promise<void> { await this.repository.remove(id); }
}
