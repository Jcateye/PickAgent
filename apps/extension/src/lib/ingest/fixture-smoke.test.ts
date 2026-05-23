import assert from "node:assert/strict"

import { realDoudianStockDiagnoseFixture, realDoudianStockListFixture } from "../fixtures/real-doudian-http"
import { syntheticDoudianPages, unsupportedSyntheticPage } from "../fixtures/synthetic-doudian"
import { mapDoudianStockListToPreview } from "./doudian-http-adapter"
import { extractDoudianCurrentPage } from "./extractor"
import { recognizeDoudianProductList } from "./page-recognition"
import { submitToRealIngestApi } from "./real-ingest-adapter"
import {
  attachMockSubmitReceipt,
  buildIngestPayload,
  collectThroughPage,
  createInitialRunState
} from "./run-state"

const firstRecognition = recognizeDoudianProductList(syntheticDoudianPages[0])
assert.equal(firstRecognition.status, "collectible")
assert.equal(firstRecognition.platform, "抖店商家后台")

const unsupportedRecognition = recognizeDoudianProductList(unsupportedSyntheticPage)
assert.equal(unsupportedRecognition.status, "unsupported")
assert.match(unsupportedRecognition.unsupportedReason ?? "", /不是已支持的抖店商品列表页/)

const secondPagePreview = extractDoudianCurrentPage(syntheticDoudianPages[1])
assert.equal(secondPagePreview.rows.length, 2)
assert.equal(secondPagePreview.mapping.length, 6)
assert.ok(secondPagePreview.warnings.some((warning) => warning.includes("缺少商品ID")))

const interruptedState = collectThroughPage(createInitialRunState(syntheticDoudianPages.length), syntheticDoudianPages, 2)
assert.equal(interruptedState.status, "paused")
assert.equal(interruptedState.currentPage, 2)
assert.equal(interruptedState.collectedRows.length, 4)

const completedState = collectThroughPage(interruptedState, syntheticDoudianPages.slice(interruptedState.currentPage))
assert.equal(completedState.status, "scanned")
assert.equal(completedState.currentPage, 3)
assert.equal(completedState.collectedRows.length, 5)

const payload = buildIngestPayload(completedState)
assert.equal(payload.schemaVersion, "extension-ingest.v1")
assert.equal(payload.rows.length, 5)
assert.ok(payload.rows.some((row) => row.salePrice === null))

const submittedState = attachMockSubmitReceipt(completedState)
assert.equal(submittedState.status, "submitted")
assert.equal(submittedState.submitReceipt?.adapter, "mock")
assert.equal(submittedState.submitReceipt?.acceptedRows, 5)

const diagnoseByKey = new Map(
  realDoudianStockDiagnoseFixture.data?.map((row) => [`${row.product_id}:${row.sku_id}`, row] as const)
)
const realPreview = mapDoudianStockListToPreview(realDoudianStockListFixture, {
  sourceUrl: "https://fxg.jinritemai.com/ffa/g/stock-manage/list",
  diagnoseByKey
})
assert.equal(realPreview.rows.length, 3)
assert.equal(realPreview.rows[0]?.externalSkuId, "3668752191222018")
assert.equal(realPreview.rows[0]?.availableStock, 20000)
assert.equal(realPreview.rows[0]?.salePrice, null)
assert.ok(realPreview.rows[0]?.warnings.some((warning) => warning.includes("缺少价格字段")))
assert.ok(realPreview.rows[0]?.warnings.some((warning) => warning.includes("category_id")))
assert.ok(realPreview.rows[2]?.warnings.some((warning) => warning.includes("is_alarming")))
assert.equal(realPreview.mapping.length, 6)

void submitToRealIngestApi(payload, {
  endpoint: "https://pickagent.local/api/ingest",
  fetcher: async (_input, init) => {
    assert.equal(init?.method, "POST")
    const submittedPayload = JSON.parse(String(init?.body))
    assert.equal(submittedPayload.schemaVersion, "extension-ingest.v1")
    assert.equal(submittedPayload.rows.length, 5)
    return new Response(JSON.stringify({ submitId: "INGEST-RUN-SYNTHETIC-DOUDIAN-L1", acceptedRows: submittedPayload.rows.length }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  }
}).then((realSubmitReceipt) => {
  assert.equal(realSubmitReceipt.adapter, "real-api")
  assert.equal(realSubmitReceipt.acceptedRows, 5)
  console.log("extension ingest real doudian fixture smoke passed")
})
