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

  if (message.type === "PICKAGENT_COLLECT_DOUDIAN_STOCK") {
    const previews = await collectDoudianStockPages({
      sourceUrl: location.href,
      pageSize: message.pageSize ?? 50,
      maxPages: message.maxPages ?? 20,
      fetcher: (input, init) => fetch(input, { ...init, credentials: "include" })
    })

    return {
      sourceUrl: location.href,
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
    const previews = (value as { previews: PageExtractionPreview[] }).previews
    return { previewCount: previews.length, rowCount: previews.reduce((sum, preview) => sum + preview.rows.length, 0) }
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
