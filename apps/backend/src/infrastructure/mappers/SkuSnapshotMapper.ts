import type { SkuSnapshot } from "../../domain/entities/SkuSnapshot";
import type { SkuSnapshotRecord } from "../persistence/SkuSnapshotRecord";
import type { SkuSnapshotResponseDto } from "../../api/dto/SkuSnapshotResponseDto";

/** SKU 采集事实快照表映射器 */
export const SkuSnapshotMapper = {
  toEntity(record: SkuSnapshotRecord): SkuSnapshot {
    return {
      id: record.id,
      skuProfileId: record.sku_profile_id,
      connectorId: record.connector_id,
      sourceUrl: record.source_url,
      rowIndex: record.row_index,
      collectedAt: record.collected_at,
      productName: record.product_name,
      category: record.category,
      sales30d: record.sales30d,
      positiveRate: record.positive_rate,
      stock: record.stock,
      originalPrice: record.original_price,
      lowestPrice30d: record.lowest_price_30d,
      campaignPrice: record.campaign_price,
      joinedBrandDay: record.joined_brand_day,
      certificateStatus: record.certificate_status,
      rawJson: record.raw_json,
      normalizedJson: record.normalized_json,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: SkuSnapshot): SkuSnapshotResponseDto {
    return {
      id: entity.id,
      skuProfileId: entity.skuProfileId,
      connectorId: entity.connectorId,
      sourceUrl: entity.sourceUrl,
      rowIndex: entity.rowIndex,
      collectedAt: entity.collectedAt,
      productName: entity.productName,
      category: entity.category,
      sales30d: entity.sales30d,
      positiveRate: entity.positiveRate,
      stock: entity.stock,
      originalPrice: entity.originalPrice,
      lowestPrice30d: entity.lowestPrice30d,
      campaignPrice: entity.campaignPrice,
      joinedBrandDay: entity.joinedBrandDay,
      certificateStatus: entity.certificateStatus,
      rawJson: entity.rawJson,
      normalizedJson: entity.normalizedJson,
      createdAt: entity.createdAt,
    };
  },
};
