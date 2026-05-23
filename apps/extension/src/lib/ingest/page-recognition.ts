import type { PageRecognitionResult } from "../../schemas/ingest"
import type { SyntheticDoudianPage } from "../fixtures/synthetic-doudian"

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
    pageIndex: page.pageIndex,
    totalPages: page.totalPages,
    reasons: ["命中抖店商品列表 URL", "命中商品行节点", "识别到分页控件"]
  }
}
