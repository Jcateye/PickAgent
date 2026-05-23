import assert from "node:assert/strict"

import { syntheticDoudianPages, unsupportedSyntheticPage } from "../fixtures/synthetic-doudian"
import { extractDoudianCurrentPage } from "./extractor"
import { recognizeDoudianProductList } from "./page-recognition"
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

console.log("extension ingest fixture smoke passed")
