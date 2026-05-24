import type {
  CollectionStatistics,
  CollectionTaskEvent,
  CollectionTaskState,
  CommentIngestCollectionPayload,
  DoudianPageType,
  IngestCollectionPayload,
  PageRecognitionResult,
  RunStatus,
  StandardCommentRow,
  StandardProductRow,
  SubmitReceipt
} from "../../schemas/ingest"
import type { SyntheticDoudianCommentPage, SyntheticDoudianPage } from "../fixtures/synthetic-doudian"
import { DoudianCommentAdapter, DoudianProductListAdapter } from "./page-adapters"

const collectedAt = "2026-05-23T00:00:00.000+08:00"

export function createInitialTaskState(totalPages = 1): CollectionTaskState {
  return buildTaskState({
    runId: "RUN-DOUDIAN-DUAL-PAGE-L2",
    status: "idle",
    activePageType: "unsupported",
    currentPage: 1,
    totalPages,
    collectedProductRows: [],
    collectedCommentRows: [],
    lastEvent: undefined,
    submitted: false
  })
}

export function resetTaskState(totalPages = 1): CollectionTaskState {
  return {
    ...createInitialTaskState(totalPages),
    status: "resetting",
    lastEvent: "RESET"
  }
}

export function recognizeProductPage(state: CollectionTaskState, page: SyntheticDoudianPage): CollectionTaskState {
  return applyRecognition(state, "product-list", DoudianProductListAdapter.recognize(page))
}

export function recognizeCommentPage(state: CollectionTaskState, page: SyntheticDoudianCommentPage): CollectionTaskState {
  return applyRecognition(state, "comment-list", DoudianCommentAdapter.recognize(page))
}

export function collectProductPage(state: CollectionTaskState, page: SyntheticDoudianPage): CollectionTaskState {
  const recognition = DoudianProductListAdapter.recognize(page)
  if (recognition.status === "unsupported") {
    return failState(state, "PAGE_UNSUPPORTED", recognition.unsupportedReason ?? "商品列表页不支持采集。")
  }

  const result = DoudianProductListAdapter.collectPage(page)
  const rows = mergeProductRows(state.collectedProductRows, result.productPreview?.rows ?? [])

  return buildTaskState({
    ...state,
    status: result.canContinue ? "paused" : "ready",
    activePageType: "product-list",
    currentPage: page.pageIndex,
    totalPages: page.totalPages,
    collectedProductRows: rows,
    currentProductPreview: result.productPreview,
    lastRecognition: recognition,
    lastEvent: "PAGE_COLLECTED",
    lastError: result.canContinue ? "已保留商品页 checkpoint，可继续自动翻页。" : undefined,
    checkpoint: {
      pageType: "product-list",
      nextPageIndex: result.nextPageIndex,
      totalPages: page.totalPages,
      productRowCount: rows.length,
      commentRowCount: state.collectedCommentRows.length,
      updatedAt: collectedAt
    }
  })
}

export function collectCommentPage(state: CollectionTaskState, page: SyntheticDoudianCommentPage): CollectionTaskState {
  const recognition = DoudianCommentAdapter.recognize(page)
  if (recognition.status === "unsupported") {
    return failState(state, "PAGE_UNSUPPORTED", recognition.unsupportedReason ?? "评价管理页不支持采集。")
  }

  const result = DoudianCommentAdapter.collectPage(page)
  const rows = mergeCommentRows(state.collectedCommentRows, result.commentPreview?.rows ?? [])

  return buildTaskState({
    ...state,
    status: result.canContinue ? "paused" : "ready",
    activePageType: "comment-list",
    currentPage: page.pageIndex,
    totalPages: page.totalPages,
    collectedCommentRows: rows,
    currentCommentPreview: result.commentPreview,
    lastRecognition: recognition,
    lastEvent: "PAGE_COLLECTED",
    lastError: result.canContinue ? "已保留评论页 checkpoint，可继续自动翻页。" : undefined,
    checkpoint: {
      pageType: "comment-list",
      nextPageIndex: result.nextPageIndex,
      totalPages: page.totalPages,
      productRowCount: state.collectedProductRows.length,
      commentRowCount: rows.length,
      updatedAt: collectedAt
    }
  })
}

export function collectAllProductPages(
  state: CollectionTaskState,
  pages: readonly SyntheticDoudianPage[],
  stopAfterPage?: number
): CollectionTaskState {
  let nextState = markCollecting(state, "collecting_products", "START")

  for (const page of pages) {
    nextState = collectProductPage(nextState, page)
    if (nextState.status === "failed") return nextState
    if (stopAfterPage === page.pageIndex) {
      return pauseState(nextState, "PAUSE", `已在商品第 ${page.pageIndex} 页暂停，可继续采集下一页。`)
    }
  }

  return buildTaskState({ ...nextState, status: "ready", lastEvent: "PAGE_COLLECTED", lastError: undefined })
}

export function collectAllCommentPages(
  state: CollectionTaskState,
  pages: readonly SyntheticDoudianCommentPage[],
  stopAfterPage?: number
): CollectionTaskState {
  let nextState = markCollecting(state, "collecting_comments", "START")

  for (const page of pages) {
    nextState = collectCommentPage(nextState, page)
    if (nextState.status === "failed") return nextState
    if (stopAfterPage === page.pageIndex) {
      return pauseState(nextState, "PAUSE", `已在评论第 ${page.pageIndex} 页暂停，可继续采集下一页。`)
    }
  }

  return buildTaskState({ ...nextState, status: "ready", lastEvent: "PAGE_COLLECTED", lastError: undefined })
}

export function pauseState(state: CollectionTaskState, event: CollectionTaskEvent, reason: string): CollectionTaskState {
  return buildTaskState({
    ...state,
    status: "paused",
    lastEvent: event,
    lastError: reason
  })
}

export function markSubmitting(state: CollectionTaskState): CollectionTaskState {
  return buildTaskState({ ...state, status: "submitting", lastEvent: "SUBMIT" })
}

export function attachTaskSubmitReceipt(state: CollectionTaskState, receipt: SubmitReceipt): CollectionTaskState {
  return buildTaskState({
    ...state,
    status: "submitted",
    submitted: true,
    submitReceipt: receipt,
    lastEvent: "SUBMIT",
    lastError: undefined
  })
}

export function refreshTaskStatistics(state: CollectionTaskState): CollectionTaskState {
  return buildTaskState(state)
}

export function buildProductIngestPayload(state: CollectionTaskState): IngestCollectionPayload {
  return {
    schemaVersion: "extension-ingest.v1",
    runId: state.runId,
    platform: "抖店商家后台",
    sourceKind: "product",
    sourceUrl: state.currentProductPreview?.sourceUrl ?? "",
    collectedAt,
    rows: state.collectedProductRows
  }
}

export function buildCommentIngestPayload(state: CollectionTaskState): CommentIngestCollectionPayload {
  return {
    schemaVersion: "extension-comment-ingest.v1",
    runId: state.runId,
    platform: "抖店商家后台",
    sourceKind: "comment",
    sourceUrl: state.currentCommentPreview?.sourceUrl ?? "",
    collectedAt,
    rows: state.collectedCommentRows,
    statistics: {
      commentCount: state.statistics.commentCount,
      lowRatingCount: state.statistics.lowRatingCount,
      negativeCommentCount: state.statistics.negativeCommentCount,
      unrepliedCommentCount: state.statistics.unrepliedCommentCount,
      latestCommentAt: state.statistics.latestCommentAt,
      commentDataCollectedAt: state.statistics.commentDataCollectedAt
    }
  }
}

export function assertNoSensitivePayloadKeys(payload: unknown): void {
  const blocked = new Set(["cookie", "token", "__token", "_lid", "authorization"])
  const keys = collectKeys(payload)
  const leaked = [...keys].find((key) => blocked.has(key.toLowerCase()))
  if (leaked) {
    throw new Error(`payload 包含敏感字段：${leaked}`)
  }
}

function applyRecognition(state: CollectionTaskState, pageType: DoudianPageType, recognition: PageRecognitionResult): CollectionTaskState {
  if (recognition.status === "unsupported") {
    return failState(state, "PAGE_UNSUPPORTED", recognition.unsupportedReason ?? "当前页面不支持采集。", recognition)
  }

  return buildTaskState({
    ...state,
    status: "ready",
    activePageType: pageType,
    currentPage: recognition.pageIndex,
    totalPages: recognition.totalPages,
    lastRecognition: recognition,
    lastEvent: "PAGE_RECOGNIZED",
    lastError: undefined
  })
}

function markCollecting(state: CollectionTaskState, status: RunStatus, event: CollectionTaskEvent): CollectionTaskState {
  return buildTaskState({ ...state, status, lastEvent: event, lastError: undefined })
}

function failState(
  state: CollectionTaskState,
  event: CollectionTaskEvent,
  message: string,
  recognition?: PageRecognitionResult
): CollectionTaskState {
  return buildTaskState({
    ...state,
    status: "failed",
    lastEvent: event,
    lastError: message,
    lastRecognition: recognition ?? state.lastRecognition
  })
}

function buildTaskState(input: Omit<CollectionTaskState, "statistics"> & { readonly statistics?: CollectionStatistics }): CollectionTaskState {
  return {
    ...input,
    statistics: buildStatistics(input.collectedProductRows, input.collectedCommentRows, input.currentPage, input.status === "failed" ? 1 : 0)
  }
}

function buildStatistics(
  productRows: readonly StandardProductRow[],
  commentRows: readonly StandardCommentRow[],
  collectedPageCount: number,
  failedPageCount: number
): CollectionStatistics {
  const warningRowCount = [...productRows, ...commentRows].filter((row) => row.warnings.length > 0).length
  const latestCommentAt = commentRows
    .map((row) => row.commentedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .slice(-1)[0] ?? null

  return {
    productCount: new Set(productRows.map((row) => row.externalProductId || row.externalSkuId || `${row.sourceUrl}:${row.rowIndex}`)).size,
    skuCount: new Set(productRows.map((row) => row.externalSkuId).filter(Boolean)).size,
    commentCount: commentRows.length,
    lowRatingCount: commentRows.filter((row) => row.rating !== null && row.rating <= 3).length,
    negativeCommentCount: commentRows.filter((row) => row.isNegative).length,
    unrepliedCommentCount: commentRows.filter((row) => row.replyStatus?.includes("未") ?? false).length,
    latestCommentAt,
    commentDataCollectedAt: collectedAt,
    warningRowCount,
    collectedPageCount,
    failedPageCount
  }
}

function mergeProductRows(existingRows: readonly StandardProductRow[], newRows: readonly StandardProductRow[]): StandardProductRow[] {
  const rowsByKey = new Map(existingRows.map((row) => [row.externalSkuId || `${row.sourceUrl}:${row.rowIndex}`, row]))
  for (const row of newRows) {
    rowsByKey.set(row.externalSkuId || `${row.sourceUrl}:${row.rowIndex}`, row)
  }
  return [...rowsByKey.values()]
}

function mergeCommentRows(existingRows: readonly StandardCommentRow[], newRows: readonly StandardCommentRow[]): StandardCommentRow[] {
  const rowsByKey = new Map(existingRows.map((row) => [row.externalCommentId || `${row.sourceUrl}:${row.rowIndex}`, row]))
  for (const row of newRows) {
    rowsByKey.set(row.externalCommentId || `${row.sourceUrl}:${row.rowIndex}`, row)
  }
  return [...rowsByKey.values()]
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return keys
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }

  for (const [key, childValue] of Object.entries(value)) {
    keys.add(key)
    collectKeys(childValue, keys)
  }
  return keys
}
