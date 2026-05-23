import type { IngestCollectionPayload } from "../../schemas/ingest"

export interface RealIngestAdapterDependency {
  readonly change: "backend-business-foundation"
  readonly requiredCapability: "ingest-and-current-projection"
  readonly status: "blocked-until-ready"
  readonly note: string
}

export const realIngestAdapterDependency: RealIngestAdapterDependency = {
  change: "backend-business-foundation",
  requiredCapability: "ingest-and-current-projection",
  status: "blocked-until-ready",
  note: "真实 ingest API 接入必须等待 backend-business-foundation 完成 ingest / projection 能力；Layer 1 仅冻结 payload 契约并使用 mock submit。"
}

export async function submitToRealIngestApi(_payload: IngestCollectionPayload): Promise<never> {
  throw new Error(realIngestAdapterDependency.note)
}
