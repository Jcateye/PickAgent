import type { SkuHealthDiagnosisCrudService } from "../../application/services/SkuHealthDiagnosisCrudService";
import type { CreateSkuHealthDiagnosisRequestDto } from "../dto/CreateSkuHealthDiagnosisRequestDto";
import type { UpdateSkuHealthDiagnosisRequestDto } from "../dto/UpdateSkuHealthDiagnosisRequestDto";
import type { SkuHealthDiagnosisQueryDto } from "../dto/SkuHealthDiagnosisQueryDto";
import type { SkuHealthDiagnosisResponseDto } from "../dto/SkuHealthDiagnosisResponseDto";

/** SKU 日常健康诊断结论表控制器骨架 */
export class SkuHealthDiagnosisController {
  constructor(private readonly service: SkuHealthDiagnosisCrudService) {}

  async list(query: SkuHealthDiagnosisQueryDto): Promise<{ items: SkuHealthDiagnosisResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<SkuHealthDiagnosisResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateSkuHealthDiagnosisRequestDto): Promise<SkuHealthDiagnosisResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateSkuHealthDiagnosisRequestDto): Promise<SkuHealthDiagnosisResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
