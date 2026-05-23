import type {
  FieldMappingPreview,
  PageExtractionPreview,
  StandardProductRow
} from "../../schemas/ingest"
import type { SyntheticDoudianPage } from "../fixtures/synthetic-doudian"

const mappingConfig = [
  { sourceLabel: "商品ID", targetKey: "externalSkuId", targetLabel: "标准字段：externalSkuId" },
  { sourceLabel: "商品标题", targetKey: "title", targetLabel: "标准字段：title" },
  { sourceLabel: "到手价", targetKey: "salePrice", targetLabel: "标准字段：salePrice" },
  { sourceLabel: "可售库存", targetKey: "availableStock", targetLabel: "标准字段：availableStock" },
  { sourceLabel: "类目", targetKey: "category", targetLabel: "标准字段：category" },
  { sourceLabel: "商品状态", targetKey: "listingStatus", targetLabel: "标准字段：listingStatus" }
] as const

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const normalizedValue = stringValue(value)

  if (!normalizedValue) {
    return null
  }

  const parsed = Number(normalizedValue)
  return Number.isFinite(parsed) ? parsed : null
}

export function extractDoudianCurrentPage(page: SyntheticDoudianPage): PageExtractionPreview {
  const rows: StandardProductRow[] = page.rows.map((row) => {
    const externalSkuId = stringValue(row.source["商品ID"])
    const title = stringValue(row.source["商品标题"])
    const salePrice = numberValue(row.source["到手价"])
    const availableStock = numberValue(row.source["可售库存"])
    const category = stringValue(row.source["类目"]) || null
    const listingStatus = stringValue(row.source["商品状态"]) || null
    const activityLabels = Array.isArray(row.source["活动标签"]) ? row.source["活动标签"].map(stringValue).filter(Boolean) : []
    const updatedAt = stringValue(row.source["更新时间"]) || null
    const warnings = [
      externalSkuId ? "" : "缺少商品ID，提交前需要人工确认行身份。",
      title ? "" : "缺少商品标题，预览无法展示商品名称。",
      salePrice === null ? "缺少到手价，payload 将保留为空值。" : "",
      availableStock === null ? "缺少可售库存，payload 将保留为空值。" : ""
    ].filter(Boolean)

    return {
      sourceKind: "product",
      rowIndex: row.rowIndex,
      externalProductId: externalSkuId || null,
      externalSkuId,
      title,
      salePrice,
      availableStock,
      category,
      listingStatus,
      activityLabels,
      updatedAt,
      sourceUrl: page.url,
      raw: row.source,
      warnings
    }
  })

  return {
    pageIndex: page.pageIndex,
    sourceUrl: page.url,
    rows,
    mapping: buildMappingPreview(page),
    warnings: rows.flatMap((row) => row.warnings)
  }
}

function buildMappingPreview(page: SyntheticDoudianPage): FieldMappingPreview[] {
  const firstRow = page.rows[0]?.source ?? {}

  return mappingConfig.map((item) => {
    const sampleValue = stringValue(firstRow[item.sourceLabel])

    return {
      sourceLabel: `页面字段：${item.sourceLabel}`,
      targetKey: item.targetKey,
      targetLabel: item.targetLabel,
      status: sampleValue ? "mapped" : "missing",
      sampleValue: sampleValue || "本页样例为空"
    }
  })
}
