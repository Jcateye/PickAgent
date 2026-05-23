import type { SkuHealthDiagnosisRecord } from "../persistence/SkuHealthDiagnosisRecord";
import type { CreateSkuHealthDiagnosisRequestDto } from "../../api/dto/CreateSkuHealthDiagnosisRequestDto";
import type { UpdateSkuHealthDiagnosisRequestDto } from "../../api/dto/UpdateSkuHealthDiagnosisRequestDto";
import type { SkuHealthDiagnosisQueryDto } from "../../api/dto/SkuHealthDiagnosisQueryDto";

/** SKU 日常健康诊断结论表仓储接口 */
export interface SkuHealthDiagnosisRepository {
  list(query: SkuHealthDiagnosisQueryDto): Promise<{ items: SkuHealthDiagnosisRecord[]; total: number }>;
  getById(id: string): Promise<SkuHealthDiagnosisRecord | null>;
  create(payload: CreateSkuHealthDiagnosisRequestDto): Promise<SkuHealthDiagnosisRecord>;
  update(id: string, payload: UpdateSkuHealthDiagnosisRequestDto): Promise<SkuHealthDiagnosisRecord>;
  remove(id: string): Promise<void>;
}
