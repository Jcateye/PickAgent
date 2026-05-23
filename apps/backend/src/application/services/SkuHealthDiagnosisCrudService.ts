import type { SkuHealthDiagnosisRepository } from "../../infrastructure/repository/SkuHealthDiagnosisRepository";
import { SkuHealthDiagnosisMapper } from "../../infrastructure/mappers/SkuHealthDiagnosisMapper";
import type { CreateSkuHealthDiagnosisRequestDto } from "../../api/dto/CreateSkuHealthDiagnosisRequestDto";
import type { UpdateSkuHealthDiagnosisRequestDto } from "../../api/dto/UpdateSkuHealthDiagnosisRequestDto";
import type { SkuHealthDiagnosisQueryDto } from "../../api/dto/SkuHealthDiagnosisQueryDto";
import type { SkuHealthDiagnosisResponseDto } from "../../api/dto/SkuHealthDiagnosisResponseDto";

/** SKU 日常健康诊断结论表基础 CRUD 服务 */
export class SkuHealthDiagnosisCrudService {
  constructor(private readonly repository: SkuHealthDiagnosisRepository) {}

  async list(query: SkuHealthDiagnosisQueryDto): Promise<{ items: SkuHealthDiagnosisResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => SkuHealthDiagnosisMapper.toResponseDto(SkuHealthDiagnosisMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<SkuHealthDiagnosisResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return SkuHealthDiagnosisMapper.toResponseDto(SkuHealthDiagnosisMapper.toEntity(record));
  }

  async create(payload: CreateSkuHealthDiagnosisRequestDto): Promise<SkuHealthDiagnosisResponseDto> {
    const created = await this.repository.create(payload);
    return SkuHealthDiagnosisMapper.toResponseDto(SkuHealthDiagnosisMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateSkuHealthDiagnosisRequestDto): Promise<SkuHealthDiagnosisResponseDto> {
    const updated = await this.repository.update(id, payload);
    return SkuHealthDiagnosisMapper.toResponseDto(SkuHealthDiagnosisMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
