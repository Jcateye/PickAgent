import type { PlasmoCSConfig } from "plasmo"

import { collectDoudianStockPages } from "../lib/ingest"

export const config: PlasmoCSConfig = {
  matches: ["https://fxg.jinritemai.com/*"]
}

type PickAgentMessage =
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

chromeApi?.runtime?.onMessage?.addListener?.((message: PickAgentMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "页面自动化执行失败。" }))

  return true
})

async function handleMessage(message: PickAgentMessage): Promise<unknown> {
  if (message.type === "PICKAGENT_COLLECT_DOUDIAN_STOCK") {
    const previews = await collectDoudianStockPages({
      sourceUrl: location.href,
      pageSize: message.pageSize ?? 50,
      maxPages: message.maxPages ?? 20,
      fetcher: (input, init) => fetch(input, { ...init, credentials: "include" })
    })

    return {
      sourceUrl: location.href,
      previews
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
