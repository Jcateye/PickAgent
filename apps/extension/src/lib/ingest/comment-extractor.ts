import type {
  CommentExtractionPreview,
  CommentFieldMappingPreview,
  StandardCommentRow
} from "../../schemas/ingest"
import type { SyntheticDoudianCommentPage } from "../fixtures/synthetic-doudian"

const commentMappingConfig = [
  { sourceLabel: "评论ID", targetKey: "externalCommentId", targetLabel: "标准字段：externalCommentId" },
  { sourceLabel: "商品ID", targetKey: "externalProductId", targetLabel: "标准字段：externalProductId" },
  { sourceLabel: "SKU ID", targetKey: "externalSkuId", targetLabel: "标准字段：externalSkuId" },
  { sourceLabel: "评分", targetKey: "rating", targetLabel: "标准字段：rating" },
  { sourceLabel: "评论内容", targetKey: "contentText", targetLabel: "标准字段：contentText" },
  { sourceLabel: "评论时间", targetKey: "commentedAt", targetLabel: "标准字段：commentedAt" },
  { sourceLabel: "回复状态", targetKey: "replyStatus", targetLabel: "标准字段：replyStatus" }
] as const

export function extractDoudianCommentPage(page: SyntheticDoudianCommentPage): CommentExtractionPreview {
  const rows: StandardCommentRow[] = page.rows.map((row) => {
    const externalCommentId = stringValue(row.source["评论ID"])
    const externalProductId = stringValue(row.source["商品ID"]) || null
    const externalSkuId = stringValue(row.source["SKU ID"]) || null
    const rating = numberValue(row.source["评分"])
    const contentText = stringValue(row.source["评论内容"]) || null
    const commentedAt = stringValue(row.source["评论时间"]) || null
    const imageCount = numberValue(row.source["图片数"]) ?? 0
    const videoCount = numberValue(row.source["视频数"]) ?? 0
    const isAfterSale = booleanValue(row.source["售后相关"])
    const isFollowUp = booleanValue(row.source["追评"])
    const replyStatus = stringValue(row.source["回复状态"]) || null
    const isNegative = rating !== null && rating <= 3
    const warnings = [
      externalCommentId ? "" : "缺少评论ID，提交前需要人工确认评论身份。",
      externalProductId ? "" : "缺少商品ID，评论无法直接关联商品。",
      externalSkuId ? "": "缺少 SKU ID，评论只能关联到商品级。",
      rating === null ? "缺少评分，评论统计无法计算低分数。" : "",
      contentText ? "" : "缺少评论内容，payload 将保留为空值。",
      replyStatus ? "" : "缺少回复状态，未回复统计可能不完整。"
    ].filter(Boolean)

    return {
      sourceKind: "comment",
      rowIndex: row.rowIndex,
      externalCommentId: externalCommentId || `unknown_comment_${page.pageIndex}_${row.rowIndex}`,
      externalProductId,
      externalSkuId,
      rating,
      contentText,
      commentedAt,
      imageCount,
      videoCount,
      isAfterSale,
      isFollowUp,
      isNegative,
      replyStatus,
      sourceUrl: page.url,
      raw: row.source,
      warnings
    }
  })

  return {
    pageIndex: page.pageIndex,
    sourceUrl: page.url,
    rows,
    mapping: buildCommentMappingPreview(page),
    warnings: rows.flatMap((row) => row.warnings)
  }
}

function buildCommentMappingPreview(page: SyntheticDoudianCommentPage): CommentFieldMappingPreview[] {
  const firstRow = page.rows[0]?.source ?? {}

  return commentMappingConfig.map((item) => {
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

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const normalizedValue = stringValue(value)
  if (!normalizedValue) return null
  const parsed = Number(normalizedValue)
  return Number.isFinite(parsed) ? parsed : null
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value
  return ["true", "是", "1", "yes"].includes(stringValue(value).toLowerCase())
}
