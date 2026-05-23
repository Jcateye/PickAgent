import type { CommentIngestCollectionPayload, IngestCollectionPayload } from "../../schemas/ingest"
import type { SubmitReceipt } from "../../schemas/ingest"

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface RealIngestAdapterDependency {
  readonly change: "backend-business-foundation"
  readonly requiredCapability: "ingest-and-current-projection"
  readonly status: "ready"
  readonly note: string
}

export const realIngestAdapterDependency: RealIngestAdapterDependency = {
  change: "backend-business-foundation",
  requiredCapability: "ingest-and-current-projection",
  status: "ready",
  note: "backend-business-foundation 已提供 ingest / projection 能力；插件可提交真实 ingest API，mock adapter 仅保留为开发与测试 fallback。"
}

export interface RealIngestSubmitOptions {
  readonly endpoint?: string
  readonly fetcher?: Fetcher
}

export async function submitToRealIngestApi(payload: IngestCollectionPayload, options: RealIngestSubmitOptions = {}): Promise<SubmitReceipt> {
  const endpoint = options.endpoint ?? "/api/ingest"
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`真实 ingest API 提交失败：HTTP ${response.status}`)
  }

  const responseBody = await safeJson(response)
  const acceptedRows = numberValue(responseBody?.acceptedRows) ?? arrayLength(responseBody?.summaries) ?? payload.rows.length
  const submitId = stringValue(responseBody?.submitId) || stringValue(responseBody?.runId) || `REAL-INGEST-${payload.runId}`

  return {
    ok: true,
    submitId,
    acceptedRows,
    adapter: "real-api",
    message: "真实 ingest API 已接收采集 payload。"
  }
}

export async function submitCommentIngestToRealApi(payload: CommentIngestCollectionPayload, options: RealIngestSubmitOptions = {}): Promise<SubmitReceipt> {
  const endpoint = options.endpoint ?? "/api/ingest/comments"
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`真实评论 ingest API 提交失败：HTTP ${response.status}`)
  }

  const responseBody = await safeJson(response)
  const acceptedRows = numberValue(responseBody?.acceptedRows) ?? arrayLength(responseBody?.summaries) ?? payload.rows.length
  const submitId = stringValue(responseBody?.submitId) || stringValue(responseBody?.runId) || `REAL-COMMENT-INGEST-${payload.runId}`

  return {
    ok: true,
    submitId,
    acceptedRows,
    adapter: "real-api",
    message: "真实评论 ingest API 已接收采集 payload，并可更新 SKU 评论统计投影。"
  }
}

async function safeJson(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const value = await response.json()
    return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function arrayLength(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined
}
