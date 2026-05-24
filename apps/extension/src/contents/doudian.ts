import type { PlasmoCSConfig } from "plasmo"

import { collectDoudianStockPages } from "../lib/ingest"
import type { PageExtractionPreview, StandardProductRow } from "../schemas/ingest"

export const config: PlasmoCSConfig = {
  matches: ["https://fxg.jinritemai.com/*"]
}

type PickAgentMessage =
  | {
      type: "PICKAGENT_PING"
    }
  | {
      type: "PICKAGENT_PAGE_SNAPSHOT"
    }
  | {
      type: "PICKAGENT_COLLECT_CURRENT_PAGE_DOM"
    }
  | {
      type: "PICKAGENT_COLLECT_DOUDIAN_STOCK"
      pageSize?: number
      maxPages?: number
    }
  | {
      type: "PICKAGENT_CLICK_TEXT"
      text: string
    }
  | {
      type: "PICKAGENT_FILL_FIELD"
      selector: string
      value: string
    }

type PickAgentResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome

console.info("[PickAgent] doudian content script loaded", {
  href: location.href,
  title: document.title,
  readyState: document.readyState
})

chromeApi?.runtime?.onMessage?.addListener?.((message: PickAgentMessage, _sender, sendResponse) => {
  console.info("[PickAgent] content message received", message.type)
  void handleMessage(message)
    .then((data) => {
      console.info("[PickAgent] content message completed", message.type, summarizeForLog(data))
      sendResponse({ ok: true, data })
    })
    .catch((error) => {
      console.error("[PickAgent] content message failed", message.type, error)
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "页面自动化执行失败。" })
    })

  return true
})

async function handleMessage(message: PickAgentMessage): Promise<unknown> {
  if (message.type === "PICKAGENT_PING") {
    return buildPageSnapshot(12)
  }

  if (message.type === "PICKAGENT_PAGE_SNAPSHOT") {
    return buildPageSnapshot(80)
  }

  if (message.type === "PICKAGENT_COLLECT_CURRENT_PAGE_DOM") {
    const preview = collectCurrentProductListDom()
    return {
      sourceUrl: location.href,
      source: "current-page-dom",
      previews: [preview]
    }
  }

  if (message.type === "PICKAGENT_COLLECT_DOUDIAN_STOCK") {
    const previews = await collectDoudianStockPages({
      sourceUrl: location.href,
      pageSize: message.pageSize ?? 50,
      maxPages: message.maxPages ?? 20,
      fetcher: (input, init) => fetch(input, { ...init, credentials: "include" })
    })

    return {
      sourceUrl: location.href,
      source: "stock-api",
      previews: previews.map(compactPreview)
    }
  }

  if (message.type === "PICKAGENT_CLICK_TEXT") {
    return clickByText(message.text)
  }

  if (message.type === "PICKAGENT_FILL_FIELD") {
    return fillField(message.selector, message.value)
  }

  throw new Error("未知页面自动化消息。")
}

function collectCurrentProductListDom(): PageExtractionPreview {
  const rowNodes = findProductRowNodes()
  const rows = rowNodes.map((node, index) => parseProductRowNode(node, index))

  const warnings = [
    rows.length === 0 ? "当前页面 DOM 未识别到包含 ID 的商品行。" : "",
    "DOM 采集只代表当前页面已渲染商品；跨页需要点击下一页后再次采集或启用页面自动翻页。"
  ].filter(Boolean)

  console.info("[PickAgent] current-page-dom collected", {
    href: location.href,
    rowCount: rows.length,
    sample: rows.slice(0, 3).map((row) => ({
      externalProductId: row.externalProductId,
      title: row.title,
      stock: row.availableStock,
      price: row.salePrice
    }))
  })

  return {
    pageIndex: readCurrentPageNumber(),
    sourceUrl: location.href,
    rows,
    mapping: [
      mappingItem("DOM 文本：ID", "externalSkuId", rows[0]?.externalSkuId),
      mappingItem("DOM 行文本：商品标题", "title", rows[0]?.title),
      mappingItem("DOM 行文本：¥价格", "salePrice", rows[0]?.salePrice),
      mappingItem("DOM 行文本：库存列候选", "availableStock", rows[0]?.availableStock),
      mappingItem("DOM 上下文：页面分类", "category", rows[0]?.category),
      mappingItem("DOM 行文本：诊断/状态", "listingStatus", rows[0]?.listingStatus)
    ],
    warnings
  }
}

function findProductRowNodes(): HTMLElement[] {
  const idNodes = Array.from(document.querySelectorAll("body *"))
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .filter((node) => /^ID[:：]\s*\d{8,}/.test(normalizeText(node.textContent)))

  const rowNodes = idNodes
    .map((node) => closestProductRow(node))
    .filter((node): node is HTMLElement => Boolean(node))

  return uniqueElements(rowNodes)
}

function closestProductRow(node: HTMLElement): HTMLElement | null {
  const preferred = node.closest("tr, [role='row'], [class*='row'], [class*='Row'], [class*='item'], [class*='Item']")
  if (preferred instanceof HTMLElement && normalizeText(preferred.textContent).includes("ID:")) return preferred

  let current: HTMLElement | null = node
  for (let depth = 0; current && depth < 6; depth += 1) {
    const text = normalizeText(current.textContent)
    if (text.includes("ID:") && /¥\s*\d/.test(text) && text.length < 2500) return current
    current = current.parentElement
  }

  return node
}

function parseProductRowNode(node: HTMLElement, rowIndex: number): StandardProductRow {
  const text = normalizeText(node.textContent)
  const productId = firstMatch(text, /ID[:：]\s*(\d{8,})/)
  const priceText = firstMatch(text, /¥\s*([0-9]+(?:\.[0-9]+)?)/)
  const stockCandidates = Array.from(text.matchAll(/\b([0-9]{1,6})\b/g)).map((match) => Number(match[1])).filter(Number.isFinite)
  const title = extractTitle(text, productId)
  const listingStatus = extractListingStatus(text)
  const availableStock = inferStock(text, stockCandidates)
  const warnings = [
    productId ? "" : "当前 DOM 行缺少商品 ID。",
    title ? "" : "当前 DOM 行缺少商品标题。",
    availableStock === null ? "当前 DOM 行未可靠识别库存列。" : "",
    priceText ? "" : "当前 DOM 行未识别价格。"
  ].filter(Boolean)

  return {
    sourceKind: "product",
    rowIndex,
    externalProductId: productId || null,
    externalSkuId: productId || `dom-row-${rowIndex}`,
    title: title || `DOM 商品 ${rowIndex + 1}`,
    salePrice: priceText ? Number(priceText) : null,
    availableStock,
    category: null,
    listingStatus,
    activityLabels: extractActivityLabels(text),
    updatedAt: firstMatch(text, /(20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2})?)/) || null,
    sourceUrl: location.href,
    raw: {
      source: "current-page-dom",
      productId: productId || null,
      textSample: text.slice(0, 600)
    },
    warnings
  }
}

function extractTitle(text: string, productId: string): string {
  const beforeId = productId ? text.split(`ID:${productId}`)[0] ?? text : text
  return beforeId
    .replace(/现货[^ ]*/g, "")
    .replace(/预览/g, "")
    .replace(/复制链接/g, "")
    .replace(/¥\s*[0-9]+(?:\.[0-9]+)?(?:\s*~\s*¥\s*[0-9]+(?:\.[0-9]+)?)?/g, "")
    .trim()
    .slice(0, 120)
}

function extractListingStatus(text: string): string | null {
  const labels = ["未诊断", "诊断豁免", "及格", "优秀", "暂无评价", "部分SKU售罄", "已售罄", "已下架"]
  const matched = labels.filter((label) => text.includes(label))
  return matched.length ? matched.join(" / ") : null
}

function extractActivityLabels(text: string): string[] {
  return ["现货预售混合", "现货模式", "奖品商品", "复制链接", "预览"].filter((label) => text.includes(label))
}

function inferStock(text: string, candidates: number[]): number | null {
  const afterPrice = text.split(/¥\s*[0-9]+(?:\.[0-9]+)?(?:\s*~\s*¥\s*[0-9]+(?:\.[0-9]+)?)?/).slice(1).join(" ")
  const afterPriceNumbers = Array.from(afterPrice.matchAll(/\b([0-9]{1,6})\b/g)).map((match) => Number(match[1])).filter(Number.isFinite)
  const usable = afterPriceNumbers.filter((value) => value >= 0 && value < 100000)
  return usable[0] ?? candidates.find((value) => value >= 0 && value < 100000) ?? null
}

function readCurrentPageNumber(): number {
  const activePageText = Array.from(document.querySelectorAll("[class*='active'], [aria-current='page'], button"))
    .map((node) => normalizeText(node.textContent))
    .find((text) => /^\d+$/.test(text))
  return activePageText ? Number(activePageText) : 1
}

function mappingItem(sourceLabel: string, targetKey: PageExtractionPreview["mapping"][number]["targetKey"], value: unknown): PageExtractionPreview["mapping"][number] {
  const sampleValue = value === null || value === undefined ? "" : String(value)
  return {
    sourceLabel,
    targetKey,
    targetLabel: `标准字段：${targetKey}`,
    status: sampleValue ? "mapped" : "missing",
    sampleValue: sampleValue || "本页样例为空"
  }
}

function firstMatch(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1]?.trim() ?? ""
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return [...new Set(elements)]
}

function buildPageSnapshot(limit: number): PageSnapshot {
  const buttonNodes = Array.from(document.querySelectorAll("button, a, [role='button'], [class*='button']"))
  const fieldNodes = Array.from(document.querySelectorAll("input, textarea, select"))
  const tableNodes = Array.from(document.querySelectorAll("table, [role='table'], [class*='table'], [class*='Table']"))

  const buttons = buttonNodes
    .slice(0, limit)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: normalizeText(element.textContent),
      ariaLabel: element.getAttribute("aria-label") ?? "",
      title: element.getAttribute("title") ?? "",
      className: typeof element.className === "string" ? element.className.slice(0, 160) : ""
    }))
    .filter((item) => item.text || item.ariaLabel || item.title)

  const fields = fieldNodes
    .slice(0, limit)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute("type") ?? "",
      placeholder: element.getAttribute("placeholder") ?? "",
      value: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? String(element.value).slice(0, 80) : "",
      name: element.getAttribute("name") ?? "",
      id: element.id,
      className: typeof element.className === "string" ? element.className.slice(0, 160) : ""
    }))

  const tables = tableNodes
    .slice(0, 12)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: normalizeText(element.textContent).slice(0, 240),
      className: typeof element.className === "string" ? element.className.slice(0, 160) : ""
    }))

  return {
    href: location.href,
    title: document.title,
    readyState: document.readyState,
    bodyTextSample: normalizeText(document.body?.innerText).slice(0, 1000),
    counts: {
      buttons: buttonNodes.length,
      fields: fieldNodes.length,
      tables: tableNodes.length
    },
    buttons,
    fields,
    tables
  }
}

function compactPreview(preview: PageExtractionPreview): PageExtractionPreview {
  return {
    ...preview,
    warnings: preview.warnings.slice(0, 200),
    rows: preview.rows.map(compactProductRow)
  }
}

function compactProductRow(row: StandardProductRow): StandardProductRow {
  const raw = row.raw as {
    fxg?: Record<string, unknown>
    extensionWarnings?: unknown
    extensionRunId?: unknown
    externalProductId?: unknown
    listingStatus?: unknown
    activityLabels?: unknown
    updatedAt?: unknown
  }

  return {
    ...row,
    raw: {
      fxg: raw.fxg ?? {},
      extensionWarnings: row.warnings,
      extensionRunId: raw.extensionRunId ?? null,
      externalProductId: row.externalProductId ?? null,
      listingStatus: row.listingStatus,
      activityLabels: row.activityLabels ?? [],
      updatedAt: row.updatedAt ?? null
    }
  }
}

function clickByText(text: string): { clicked: boolean; text: string } {
  const target = Array.from(document.querySelectorAll("button, a, [role='button'], [class*='button']"))
    .find((element) => normalizeText(element.textContent).includes(text))

  if (!(target instanceof HTMLElement)) {
    throw new Error(`未找到可点击元素：${text}`)
  }

  target.click()
  return { clicked: true, text: normalizeText(target.textContent) }
}

function fillField(selector: string, value: string): { filled: boolean; selector: string } {
  const target = document.querySelector(selector)
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    throw new Error(`未找到可填写字段：${selector}`)
  }

  setNativeValue(target, value)
  target.dispatchEvent(new Event("input", { bubbles: true }))
  target.dispatchEvent(new Event("change", { bubbles: true }))
  target.dispatchEvent(new Event("blur", { bubbles: true }))

  return { filled: true, selector }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = Object.getPrototypeOf(element) as { value?: string }
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
  descriptor?.set?.call(element, value)
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function summarizeForLog(value: unknown): unknown {
  if (!value || typeof value !== "object") return value
  if ("previews" in value && Array.isArray((value as { previews?: unknown[] }).previews)) {
    const result = value as { previews: PageExtractionPreview[]; source?: string }
    return { source: result.source ?? "unknown", previewCount: result.previews.length, rowCount: result.previews.reduce((sum, preview) => sum + preview.rows.length, 0) }
  }
  if ("href" in value) {
    const snapshot = value as PageSnapshot
    return { href: snapshot.href, title: snapshot.title, counts: snapshot.counts }
  }
  return { type: typeof value }
}

interface PageSnapshot {
  href: string
  title: string
  readyState: string
  bodyTextSample: string
  counts: {
    buttons: number
    fields: number
    tables: number
  }
  buttons: Array<Record<string, string>>
  fields: Array<Record<string, string>>
  tables: Array<Record<string, string>>
}

interface ChromeLike {
  runtime?: {
    onMessage?: {
      addListener?: (
        callback: (
          message: PickAgentMessage,
          sender: unknown,
          sendResponse: (response: PickAgentResponse) => void
        ) => true | void
      ) => void
    }
  }
}
