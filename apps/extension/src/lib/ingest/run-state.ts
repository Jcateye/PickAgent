import type {
  CollectionRunState,
  IngestCollectionPayload,
  MockSubmitReceipt,
  PageExtractionPreview,
  StandardProductRow
} from "../../schemas/ingest"
import type { SyntheticDoudianPage } from "../fixtures/synthetic-doudian"
import { extractDoudianCurrentPage } from "./extractor"
import { recognizeDoudianProductList } from "./page-recognition"

export function createInitialRunState(totalPages: number): CollectionRunState {
  return {
    runId: "RUN-SYNTHETIC-DOUDIAN-L1",
    status: "idle",
    currentPage: 1,
    totalPages,
    collectedRows: []
  }
}

export function scanCurrentPage(state: CollectionRunState, page: SyntheticDoudianPage): CollectionRunState {
  const recognition = recognizeDoudianProductList(page)

  if (recognition.status === "unsupported") {
    return {
      ...state,
      status: "failed",
      currentPage: page.pageIndex,
      interruptionReason: recognition.unsupportedReason
    }
  }

  return {
    ...state,
    status: "scanned",
    currentPage: page.pageIndex,
    currentPreview: extractDoudianCurrentPage(page),
    interruptionReason: undefined
  }
}

export function collectThroughPage(
  state: CollectionRunState,
  pages: readonly SyntheticDoudianPage[],
  stopAfterPage?: number
): CollectionRunState {
  let nextState: CollectionRunState = { ...state, status: "collecting", interruptionReason: undefined }
  const collectedRows: StandardProductRow[] = [...state.collectedRows]
  let currentPreview: PageExtractionPreview | undefined = state.currentPreview

  for (const page of pages) {
    const recognition = recognizeDoudianProductList(page)

    if (recognition.status === "unsupported") {
      return {
        ...nextState,
        status: "paused",
        currentPage: page.pageIndex,
        collectedRows,
        currentPreview,
        interruptionReason: recognition.unsupportedReason
      }
    }

    currentPreview = extractDoudianCurrentPage(page)
    collectedRows.push(...currentPreview.rows)
    nextState = {
      ...nextState,
      currentPage: page.pageIndex,
      totalPages: page.totalPages,
      collectedRows,
      currentPreview
    }

    if (stopAfterPage === page.pageIndex) {
      return {
        ...nextState,
        status: "paused",
        interruptionReason: `已在第 ${page.pageIndex} 页保留中断点，可继续采集下一页。`
      }
    }
  }

  return {
    ...nextState,
    status: "scanned",
    interruptionReason: undefined
  }
}

export function buildIngestPayload(state: CollectionRunState): IngestCollectionPayload {
  return {
    schemaVersion: "extension-ingest.v1",
    runId: state.runId,
    platform: "抖店商家后台",
    sourceUrl: state.currentPreview?.sourceUrl ?? "",
    collectedAt: "2026-05-23T00:00:00.000+08:00",
    rows: state.collectedRows
  }
}

export function mockSubmitIngestPayload(payload: IngestCollectionPayload): MockSubmitReceipt {
  return {
    ok: true,
    submitId: `MOCK-SUBMIT-${payload.runId}`,
    acceptedRows: payload.rows.length,
    adapter: "mock",
    message: "已通过 mock submit adapter 接收采集 payload；真实 ingest 仍依赖 backend-business-foundation。"
  }
}

export function attachMockSubmitReceipt(state: CollectionRunState): CollectionRunState {
  return {
    ...state,
    status: "submitted",
    submitReceipt: mockSubmitIngestPayload(buildIngestPayload(state))
  }
}
