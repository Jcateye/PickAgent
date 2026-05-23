import type { SkuProfile } from "../../domain/entities/SkuProfile";
import type { SkuProfileRecord } from "../persistence/SkuProfileRecord";
import type { SkuProfileResponseDto } from "../../api/dto/SkuProfileResponseDto";

/** 长期 SKU 档案表，承接采集事实、健康结论、活动模拟和 Review映射器 */
export const SkuProfileMapper = {
  toEntity(record: SkuProfileRecord): SkuProfile {
    return {
      id: record.id,
      canonicalKey: record.canonical_key,
      platform: record.platform,
      storeId: record.store_id,
      externalSkuId: record.external_sku_id,
      productName: record.product_name,
      category: record.category,
      brand: record.brand,
      status: record.status,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: SkuProfile): SkuProfileResponseDto {
    return {
      id: entity.id,
      canonicalKey: entity.canonicalKey,
      platform: entity.platform,
      storeId: entity.storeId,
      externalSkuId: entity.externalSkuId,
      productName: entity.productName,
      category: entity.category,
      brand: entity.brand,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
