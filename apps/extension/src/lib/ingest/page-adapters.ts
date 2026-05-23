import type {
  CommentExtractionPreview,
  DoudianPageType,
  PageExtractionPreview,
  PageRecognitionResult
} from "../../schemas/ingest"
import type { SyntheticDoudianCommentPage, SyntheticDoudianPage } from "../fixtures/synthetic-doudian"
import { extractDoudianCommentPage } from "./comment-extractor"
import { extractDoudianCurrentPage } from "./extractor"
import { recognizeDoudianCommentList, recognizeDoudianProductList } from "./page-recognition"

export interface PageCollectionResult {
  readonly pageType: DoudianPageType
  readonly productPreview?: PageExtractionPreview
  readonly commentPreview?: CommentExtractionPreview
  readonly nextPageIndex: number
  readonly canContinue: boolean
  readonly warnings: readonly string[]
}

export interface DoudianPageAdapter<TPage> {
  readonly pageType: DoudianPageType
  recognize(page: TPage): PageRecognitionResult
  collectPage(page: TPage): PageCollectionResult
  goNextPage(pages: readonly TPage[], currentPageIndex: number): TPage | undefined
  canContinue(page: TPage): boolean
  buildPreview(page: TPage): PageExtractionPreview | CommentExtractionPreview
}

export const DoudianProductListAdapter: DoudianPageAdapter<SyntheticDoudianPage> = {
  pageType: "product-list",
  recognize: recognizeDoudianProductList,
  collectPage(page) {
    const recognition = recognizeDoudianProductList(page)
    if (recognition.status === "unsupported") {
      return {
        pageType: "unsupported",
        nextPageIndex: page.pageIndex,
        canContinue: false,
        warnings: [recognition.unsupportedReason ?? "商品列表页识别失败。"]
      }
    }

    const productPreview = extractDoudianCurrentPage(page)
    return {
      pageType: "product-list",
      productPreview,
      nextPageIndex: page.pageIndex + 1,
      canContinue: this.canContinue(page),
      warnings: productPreview.warnings
    }
  },
  goNextPage(pages, currentPageIndex) {
    return pages.find((page) => page.pageIndex === currentPageIndex + 1)
  },
  canContinue(page) {
    return page.pageIndex < page.totalPages && !page.selectors.includes(".pagination-disabled-next")
  },
  buildPreview: extractDoudianCurrentPage
}

export const DoudianCommentAdapter: DoudianPageAdapter<SyntheticDoudianCommentPage> = {
  pageType: "comment-list",
  recognize: recognizeDoudianCommentList,
  collectPage(page) {
    const recognition = recognizeDoudianCommentList(page)
    if (recognition.status === "unsupported") {
      return {
        pageType: "unsupported",
        nextPageIndex: page.pageIndex,
        canContinue: false,
        warnings: [recognition.unsupportedReason ?? "评价管理页识别失败。"]
      }
    }

    const commentPreview = extractDoudianCommentPage(page)
    return {
      pageType: "comment-list",
      commentPreview,
      nextPageIndex: page.pageIndex + 1,
      canContinue: this.canContinue(page),
      warnings: commentPreview.warnings
    }
  },
  goNextPage(pages, currentPageIndex) {
    return pages.find((page) => page.pageIndex === currentPageIndex + 1)
  },
  canContinue(page) {
    return page.pageIndex < page.totalPages && !page.selectors.includes(".pagination-disabled-next")
  },
  buildPreview: extractDoudianCommentPage
}
