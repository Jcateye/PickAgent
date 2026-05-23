import fs from "node:fs";
import path from "node:path";

import doudianAdapterModule from "../apps/extension/src/lib/ingest/doudian-http-adapter.ts";
import payloadModule from "../apps/extension/src/lib/ingest/foundation-ingest-payload.ts";
import fixtureModule from "../apps/extension/src/lib/fixtures/real-doudian-http.ts";

const fixtureDir = process.env.FIXTURE_DIR ?? "output/final-cross-module-acceptance/fixtures";
fs.mkdirSync(fixtureDir, { recursive: true });

const { mapDoudianStockListToPreview } = doudianAdapterModule;
const { toFoundationIngestPayload } = payloadModule;
const {
  realDoudianStockListFirstPageFixture,
  realDoudianStockListSecondPageFixture,
  realDoudianStockDiagnoseFixture,
} = fixtureModule;

const diagnoseByKey = new Map(
  (realDoudianStockDiagnoseFixture.data ?? []).map((row) => [`${String(row.product_id ?? "")}:${String(row.sku_id ?? "")}`, row]),
);

const firstPreview = mapDoudianStockListToPreview(realDoudianStockListFirstPageFixture, {
  sourceUrl: "https://fxg.jinritemai.com/ffa/g/list",
  diagnoseByKey,
});
const secondPreview = mapDoudianStockListToPreview(realDoudianStockListSecondPageFixture, {
  sourceUrl: "https://fxg.jinritemai.com/ffa/g/list?page=2",
  diagnoseByKey,
});

const ingestPayload = toFoundationIngestPayload(
  {
    schemaVersion: "extension-ingest.v1",
    runId: "final-cross-module-acceptance-seed",
    platform: "doudian",
    sourceKind: "product",
    sourceUrl: "https://fxg.jinritemai.com/ffa/g/list",
    collectedAt: "2026-05-24T09:00:00.000Z",
    rows: [...firstPreview.rows, ...secondPreview.rows],
  },
  {
    connectorId: "doudian-browser-extension",
    storeId: "fxg.jinritemai.com",
  },
);

const parseRequest = {
  name: "抖店库存与商机活动准入验收规则",
  platform: "douyin_fxg",
  sourceText: "活动库存不得低于 80 件；商机线索类活动要求人工复核。",
  rules: [
    {
      id: "stock_min_acceptance",
      type: "threshold",
      field: "stock",
      operator: "gte",
      value: 80,
      message: "活动库存不得低于 80 件",
      severity: "blocking",
    },
    {
      id: "business_chance_manual_review",
      type: "manual_review",
      message: "business_chance_center 商机线索必须人工复核",
      severity: "warning",
    },
  ],
};

const sourceEndpoints = [
  {
    endpoint: "POST /stock/manage/list",
    note: "来自真实抖店库存列表 fixture（第一页+第二页）",
  },
  {
    endpoint: "POST /stock/manage/sku_stock_diagnose",
    note: "SKU 诊断 fixture 注入 is_alarming evidence",
  },
];

writeJson(path.join(fixtureDir, "ingest-payload.json"), ingestPayload);
writeJson(path.join(fixtureDir, "activity-parse-request.json"), parseRequest);
writeJson(path.join(fixtureDir, "source-endpoints.json"), sourceEndpoints);

console.log(
  JSON.stringify(
    {
      fixtureDir,
      ingestRows: ingestPayload.rows.length,
      parseRules: parseRequest.rules.length,
    },
    null,
    2,
  ),
);

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
