import { createFinalApiPersistenceRuntime } from "../../src/application/foundation/FinalApiPersistenceFoundation";
import type { P0AuthContextDto } from "../../src/application/foundation/P0AuthBoundaryRuntimeConfig";

const boundary: P0AuthContextDto = {
  actorId: "agent_connector",
  tenantId: "tenant_connector",
  sessionId: "session_connector",
  surface: "unit-smoke",
  requestId: "req_connector_smoke",
};

async function smoke(): Promise<void> {
  const runtime = createFinalApiPersistenceRuntime({ adapter: "memory" });
  const connector = await runtime.connectorService.create({
    code: "browser_tmall",
    name: "浏览器插件采集",
    kind: "browser_extension",
    platform: "tmall",
    config: { source: "browser", permissions: ["read_product", "read_inventory"], token: "secret" },
  }, boundary);

  if (connector.config.token !== "[REDACTED]") throw new Error("connector config must redact token-like fields");
  if (!connector.traceRef.entityId) throw new Error("connector traceRef is required");

  const preview = runtime.browserConnectorService.scanPreview({
    connectorId: connector.connectorId,
    url: "https://tmall.example/item/list",
    rows: [{ skuId: "SKU-1", title: "商品 A", stock: 20, sales30d: 300 }],
  });
  if (preview.rowCount !== 1 || preview.ingestReady !== true) throw new Error("scan preview should be ingest-ready for mapped tmall rows");

  const run = await runtime.connectorService.createSyncRun(connector.connectorId, {
    rowCount: preview.rowCount,
    qualityScore: preview.qualityScore,
    warnings: preview.warnings,
    summary: { previewOnly: true },
  }, boundary);
  if (!run.workflowRunRef?.entityId) throw new Error("connector sync run must carry workflow audit ref");

  const runs = await runtime.connectorService.listRuns(connector.connectorId, 1, 20, boundary);
  if (runs.total !== 1 || runs.items[0]?.connectorRunId !== run.connectorRunId) throw new Error("connector run list should include created run");
}

void smoke();
