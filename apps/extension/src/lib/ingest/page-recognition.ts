import type { PageRecognitionResult } from "../../schemas/ingest"
import type { SyntheticDoudianCommentPage, SyntheticDoudianPage } from "../fixtures/synthetic-doudian"

export function recognizeDoudianProductList(page: SyntheticDoudianPage): PageRecognitionResult {
  const hasProductUrl = page.url.includes("/g/list")
  const hasProductRows = page.selectors.includes("[data-e2e='product-row']") && page.rows.length > 0
  const hasProductTitle = page.title.includes("商品")

  if (!hasProductUrl || !hasProductRows) {
    return {
      status: "unsupported",
      confidence: hasProductTitle ? 0.42 : 0.18,
      platform: page.platform,
      pageType: "未知页面",
      sourceKind: "product",
      pageIndex: page.pageIndex,
      totalPages: page.totalPages,
      reasons: ["未命中商品列表 URL 与商品行结构"],
      unsupportedReason: "当前页面不是已支持的抖店商品列表页，采集已阻止。"
    }
  }

  return {
    status: "collectible",
    confidence: 0.96,
    platform: page.platform,
    pageType: "商品列表页",
    sourceKind: "product",
    pageIndex: page.pageIndex,
    totalPages: page.totalPages,
    reasons: ["命中抖店商品列表 URL", "命中商品行节点", "识别到分页控件"]
  }
}

export function recognizeDoudianCommentList(page: SyntheticDoudianCommentPage): PageRecognitionResult {
  const hasCommentUrl = page.url.includes("/ffa/maftersale/comment")
  const hasCommentRows = page.selectors.includes("[data-e2e='comment-row']")
  const hasCommentTitle = page.title.includes("评价") || page.title.includes("评论")

  if (!hasCommentUrl || (!hasCommentRows && page.rows.length > 0)) {
    return {
      status: "unsupported",
      confidence: hasCommentTitle ? 0.46 : 0.18,
      platform: page.platform,
      pageType: "未知页面",
      sourceKind: "comment",
      pageIndex: page.pageIndex,
      totalPages: page.totalPages,
      reasons: ["未命中评价管理 URL 与评论行结构"],
      unsupportedReason: "当前页面不是已支持的抖店评价管理页，采集已阻止。"
    }
  }

  return {
    status: "collectible",
    confidence: page.rows.length > 0 ? 0.95 : 0.86,
    platform: page.platform,
    pageType: "评价管理页",
    sourceKind: "comment",
    pageIndex: page.pageIndex,
    totalPages: page.totalPages,
    reasons: page.rows.length > 0 ? ["命中抖店评价管理 URL", "命中评论行节点", "识别到分页控件"] : ["命中抖店评价管理 URL", "当前页为空评论页"]
  }
}
