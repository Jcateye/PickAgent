#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3204";
const evidenceDir = process.env.EVIDENCE_DIR ?? "output/final-cross-module-acceptance/http-smoke";
const fixtureDir = "output/final-cross-module-acceptance/fixtures";

fs.mkdirSync(evidenceDir, { recursive: true });

const ingestPayload = readJson(path.join(fixtureDir, "ingest-payload.json"));
const parsePayload = readJson(path.join(fixtureDir, "activity-parse-request.json"));

const result = {
  baseUrl,
  chainA: {},
  chainB: {},
  chainC: {},
  chainD: {},
  generatedAt: new Date().toISOString(),
};

const ingestResponse = await callJson("POST", "/api/ingest", ingestPayload, "chain-a-01-ingest");
const healthResponse = await callJson("GET", "/api/health/summary", null, "chain-a-02-health-summary");
const skusResponse = await callJson("GET", "/api/skus?page=1&pageSize=100", null, "chain-a-03-sku-list");
const skuItems = ensureArray(skusResponse.data?.items, "chain A sku list items");
const firstSkuProfileId = ingestResponse.data?.summaries?.[0]?.skuProfileId ?? skuItems[0]?.skuProfileId;
if (!firstSkuProfileId) {
  throw new Error("chain A failed: cannot resolve first skuProfileId");
}
const skuDetailResponse = await callJson("GET", `/api/skus/${encodeURIComponent(firstSkuProfileId)}`, null, "chain-a-04-sku-detail");

result.chainA = {
  workflowRunId: ingestResponse.data?.workflowRunId ?? null,
  acceptedRows: Array.isArray(ingestResponse.data?.summaries) ? ingestResponse.data.summaries.length : 0,
  healthTotal: healthResponse.data?.total ?? null,
  skuListTotal: skusResponse.data?.total ?? null,
  firstSkuProfileId,
  firstSkuPlatform: skuDetailResponse.data?.platform ?? null,
  firstSkuEvidenceCount: Array.isArray(skuDetailResponse.data?.evidence) ? skuDetailResponse.data.evidence.length : 0,
};

const parseResponse = await callJson("POST", "/api/activities/parse", parsePayload, "chain-b-01-activity-parse");
const ruleSetId = parseResponse.data?.ruleSetId;
if (!ruleSetId) {
  throw new Error("chain B failed: parse response missing ruleSetId");
}
const simulationRequest = {
  skuProfileIds: skuItems.slice(0, 3).map((item) => item.skuProfileId),
  whatIf: { stock: 12 },
};
const simulationResponse = await callJson("POST", `/api/activities/${encodeURIComponent(ruleSetId)}/simulations`, simulationRequest, "chain-b-02-activity-simulation");
const simulationResults = ensureArray(simulationResponse.data?.results, "chain B simulation results");
const reviewCreateItems = simulationResults
  .filter((item) => item.eligibility === "MANUAL_REVIEW" || item.eligibility === "BLOCKED")
  .slice(0, 2)
  .map((item) => ({
    skuProfileId: item.skuProfileId,
    sourceType: "simulation",
    sourceId: item.simulationResultId,
    question: "商机活动准入是否允许继续推进？",
    recommendation: "先由运营确认线索，再回归模拟。",
    riskLevel: "L2",
    evidence: item.evidence ?? [],
  }));
if (reviewCreateItems.length === 0 && simulationResults.length > 0) {
  const first = simulationResults[0];
  reviewCreateItems.push({
    skuProfileId: first.skuProfileId,
    sourceType: "simulation",
    sourceId: first.simulationResultId,
    question: "无 MANUAL_REVIEW 时兜底创建一个 Review item，确认审批链路。",
    recommendation: "人工确认活动准入判断。",
    riskLevel: "L1",
    evidence: first.evidence ?? [],
  });
}
const reviewsCreateResponse = await callJson("POST", "/api/reviews", { items: reviewCreateItems }, "chain-b-03-review-create");
const reviewItems = ensureArray(reviewsCreateResponse.data, "chain B reviews create data");
const firstReviewId = reviewItems[0]?.reviewItemId;
if (!firstReviewId) {
  throw new Error("chain B failed: review create response missing reviewItemId");
}
const reviewDecisionResponse = await callJson(
  "POST",
  `/api/reviews/${encodeURIComponent(firstReviewId)}/decision`,
  {
    decision: "REQUEST_CHANGES",
    decisionBy: "final-acceptance@pickagent.local",
    decisionComment: "验收 smoke：需要补齐活动线索归属后重跑。",
  },
  "chain-b-04-review-decision",
);
const reportRequest = {
  type: "ACTIVITY",
  skuProfileIds: simulationRequest.skuProfileIds,
  simulationResultIds: simulationResults.map((item) => item.simulationResultId),
};
const reportResponse = await callJson("POST", "/api/reports", reportRequest, "chain-b-05-report-preview");

result.chainB = {
  ruleSetId,
  parseStatus: parseResponse.data?.parseStatus ?? null,
  simulationRunId: simulationResponse.data?.simulationRunId ?? null,
  simulationResultCount: simulationResults.length,
  reviewItemId: firstReviewId,
  reviewDecisionStatus: reviewDecisionResponse.data?.status ?? null,
  reportId: reportResponse.data?.reportId ?? null,
  reportStatus: reportResponse.data?.status ?? null,
};

const missionResponse = await callJson(
  "POST",
  "/api/agent/missions",
  {
    sessionKey: "final-cross-module-acceptance-session",
    objective: "验证 WorkbenchContext 到 Agent sidecar/SSE/Review Gate 主链路",
  },
  "chain-c-01-agent-mission-create",
);
const missionId = missionResponse.data?.mission?.id;
if (!missionId) {
  throw new Error("chain C failed: mission response missing mission.id");
}
const runResponse = await callJson(
  "POST",
  `/api/agent/missions/${encodeURIComponent(missionId)}/runs`,
  {
    modelProvider: "pi",
    modelName: "pi-tool-policy-poc",
    inputJson: { objective: "acceptance chain C replay/sse smoke" },
  },
  "chain-c-02-agent-run-start",
);
const runId = runResponse.data?.id;
if (!runId) {
  throw new Error("chain C failed: run response missing run id");
}
const replayResponse = await callJson("GET", `/api/agent/runs/${encodeURIComponent(runId)}/events?after=0`, null, "chain-c-03-agent-events-replay");
const sseResponse = await callRaw(
  "GET",
  `/api/agent/runs/${encodeURIComponent(runId)}/events?after=0&stream=1`,
  null,
  "chain-c-04-agent-events-sse",
  { accept: "text/event-stream" },
);

result.chainC = {
  missionId,
  runId,
  replayEvents: ensureArray(replayResponse.data?.items, "chain C replay items").length,
  replayAfter: replayResponse.data?.after ?? null,
  sseHasRunStartedEvent: sseResponse.body.includes("event: run.started"),
};

const piSmokeResponse = await callJson("POST", "/api/agent/pi/smoke", null, "chain-d-01-pi-smoke");
const reviewGateId = piSmokeResponse.data?.reviewGate?.id;
if (!reviewGateId) {
  throw new Error("chain D failed: pi smoke response missing reviewGate.id");
}
const gateDecisionResponse = await callJson(
  "POST",
  `/api/agent/review-gates/${encodeURIComponent(reviewGateId)}/decision`,
  {
    decision: "APPROVE",
    decidedBy: "final-acceptance@pickagent.local",
    decisionComment: "验收 smoke：批准继续，验证 continuation replay。",
  },
  "chain-d-02-review-gate-decision",
);
const piRunId = piSmokeResponse.data?.run?.id;
const continuationRunId = gateDecisionResponse.data?.continuationRun?.id;
const piRunEvents =
  piRunId
    ? await callJson("GET", `/api/agent/runs/${encodeURIComponent(piRunId)}/events?after=0`, null, "chain-d-03-run-events")
    : null;
const continuationEvents =
  continuationRunId
    ? await callJson("GET", `/api/agent/runs/${encodeURIComponent(continuationRunId)}/events?after=0`, null, "chain-d-04-continuation-events")
    : null;

result.chainD = {
  piRunId: piRunId ?? null,
  reviewGateId,
  gateStatus: gateDecisionResponse.data?.gate?.status ?? null,
  continuationRunId: continuationRunId ?? null,
  piVisibleTools: ensureArray(piSmokeResponse.data?.piVisibleTools, "chain D piVisibleTools"),
  disabledRuntimeTools: ensureArray(piSmokeResponse.data?.disabledRuntimeTools, "chain D disabledRuntimeTools"),
  piRunEventCount: piRunEvents ? ensureArray(piRunEvents.data?.items, "chain D run events").length : 0,
  continuationEventCount: continuationEvents ? ensureArray(continuationEvents.data?.items, "chain D continuation events").length : 0,
};

writeJson(path.join(evidenceDir, "summary.json"), result);
console.log(JSON.stringify(result, null, 2));

async function callJson(method, routePath, body, prefix, headers = {}) {
  const response = await callRaw(method, routePath, body, prefix, headers);
  const parsed = safeJsonParse(response.body);
  if (!response.ok) {
    throw new Error(`${prefix} failed with HTTP ${response.status}`);
  }
  if (!parsed || parsed.code !== "OK") {
    throw new Error(`${prefix} failed: expected envelope code OK`);
  }
  return parsed;
}

async function callRaw(method, routePath, body, prefix, headers = {}) {
  const url = `${baseUrl}${routePath}`;
  const requestPayload = body === null || body === undefined ? null : body;
  if (requestPayload !== null) {
    writeJson(path.join(evidenceDir, `${prefix}-request.json`), requestPayload);
  }
  const response = await fetch(url, {
    method,
    headers: requestPayload === null ? headers : { "content-type": "application/json", ...headers },
    body: requestPayload === null ? undefined : JSON.stringify(requestPayload),
  });
  const bodyText = await response.text();
  const statusPath = path.join(evidenceDir, `${prefix}-status.txt`);
  fs.writeFileSync(statusPath, `${response.status}\n`, "utf8");
  const parsed = safeJsonParse(bodyText);
  if (parsed) {
    writeJson(path.join(evidenceDir, `${prefix}-response.json`), parsed);
  } else {
    fs.writeFileSync(path.join(evidenceDir, `${prefix}-response.txt`), bodyText, "utf8");
  }
  return { ok: response.ok, status: response.status, body: bodyText };
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureArray(value, label) {
  if (Array.isArray(value)) return value;
  throw new Error(`${label} is not an array`);
}
