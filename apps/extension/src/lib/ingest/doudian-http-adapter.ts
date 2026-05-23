import type { FieldMappingPreview, PageExtractionPreview, StandardProductRow } from "../../schemas/ingest"

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface DoudianStockListResponse {
  readonly code?: number
  readonly msg?: string
  readonly page?: number
  readonly size?: number
  readonly total?: number
  readonly data?: readonly DoudianStockProduct[]
}

export interface DoudianStockProduct {
  readonly product_id?: string
  readonly product_name?: string
  readonly category_id?: number | string
  readonly status?: number
  readonly draft_status?: number
  readonly check_status?: number
  readonly stock_type?: number
  readonly shipping_mode?: number
  readonly total_stock_num?: number
  readonly total_unoccupied_stock_num?: number
  readonly total_occupied_stock_num?: number
  readonly is_alarming?: boolean
  readonly tags?: readonly string[]
  readonly skus?: readonly DoudianStockSku[]
}

export interface DoudianStockSku {
  readonly sku_id?: string
  readonly sku_name?: string
  readonly status?: number
  readonly total_stock_num?: number
  readonly total_unoccupied_stock_num?: number
  readonly total_occupied_stock_num?: number
  readonly is_alarming?: boolean
  readonly forbid_edit?: boolean
  readonly forbid_edit_reason?: string
}

export interface DoudianStockDiagnoseResponse {
  readonly code?: number
  readonly msg?: string
  readonly data?: readonly DoudianStockDiagnoseRow[]
}

export interface DoudianStockDiagnoseRow {
  readonly product_id?: string
  readonly sku_id?: string
  readonly is_alarming?: boolean
}

export interface DoudianHttpCollectOptions {
  readonly sourceUrl: string
  readonly pageSize?: number
  readonly maxPages?: number
  readonly fetcher?: Fetcher
}

const listPath = "/stock/manage/list"
const diagnosePath = "/stock/manage/sku_stock_diagnose"

export async function collectDoudianStockPages(options: DoudianHttpCollectOptions): Promise<PageExtractionPreview[]> {
  const fetcher = options.fetcher ?? fetch
  const pageSize = options.pageSize ?? 50
  const maxPages = options.maxPages ?? 20
  const previews: PageExtractionPreview[] = []

  for (let page = 1; page <= maxPages; page += 1) {
    const stockList = await postDoudianJson<DoudianStockListResponse>(fetcher, listPath, {
      page,
      pageSize,
      page_size: pageSize,
      sort: 0
    })
    const products = stockList.data ?? []
    const diagnoseByKey = await fetchDiagnoseBySku(fetcher, products)
    const preview = mapDoudianStockListToPreview(stockList, {
      sourceUrl: options.sourceUrl,
      diagnoseByKey
    })

    previews.push(preview)

    const total = stockList.total ?? previews.flatMap((item) => item.rows).length
    const collectedProductCount = page * pageSize
    if (!products.length || collectedProductCount >= total) {
      break
    }
  }

  return previews
}

export function mapDoudianStockListToPreview(
  response: DoudianStockListResponse,
  input: { sourceUrl: string; diagnoseByKey?: ReadonlyMap<string, DoudianStockDiagnoseRow> }
): PageExtractionPreview {
  const rows: StandardProductRow[] = []

  if (response.code !== undefined && response.code !== 0) {
    return {
      pageIndex: response.page ?? 1,
      sourceUrl: input.sourceUrl,
      rows,
      mapping: buildDoudianHttpMappingPreview(response.data?.[0]),
      warnings: [`抖店库存接口返回非 0 状态码：${response.code}${response.msg ? ` ${response.msg}` : ""}`]
    }
  }

  for (const [productIndex, product] of (response.data ?? []).entries()) {
    const skus = product.skus?.length ? product.skus : [{ sku_id: product.product_id, sku_name: product.product_name }]

    for (const [skuIndex, sku] of skus.entries()) {
      const productId = stringValue(product.product_id)
      const skuId = stringValue(sku.sku_id)
      const diagnose = input.diagnoseByKey?.get(diagnoseKey(productId, skuId))
      const title = [product.product_name, sku.sku_name].map(stringValue).filter(Boolean).join(" / ")
      const category = product.category_id === undefined || product.category_id === null ? null : String(product.category_id)
      const availableStock = numberOrNull(sku.total_unoccupied_stock_num ?? sku.total_stock_num ?? product.total_unoccupied_stock_num ?? product.total_stock_num)
      const warnings = [
        productId ? "" : "缺少 product_id，无法关联商品级原始记录。",
        skuId ? "" : "缺少 sku_id，提交前需要人工确认 SKU 身份。",
        "缺少价格字段，stock/manage/list 未返回 sale price。",
        category ? "缺少类目名称，仅保留 category_id。" : "缺少类目信息，payload 将保留为空值。",
        availableStock === null ? "缺少可用库存，payload 将保留为空值。" : "",
        diagnose?.is_alarming || sku.is_alarming || product.is_alarming ? "库存诊断接口标记 is_alarming，作为采集层风险保留。" : ""
      ].filter(Boolean)

      rows.push({
        sourceKind: "product",
        rowIndex: rows.length,
        externalProductId: productId || null,
        externalSkuId: skuId || productId || `unknown_${productIndex}_${skuIndex}`,
        title,
        salePrice: null,
        availableStock,
        category,
        listingStatus: sku.status === undefined && product.status === undefined ? null : `product:${product.status ?? "unknown"};sku:${sku.status ?? "unknown"}`,
        activityLabels: product.tags ?? [],
        updatedAt: null,
        sourceUrl: input.sourceUrl,
        raw: {
          product,
          sku,
          stockDiagnose: diagnose ?? null,
          fxg: {
            productId,
            skuId,
            productStatus: product.status,
            skuStatus: sku.status,
            draftStatus: product.draft_status,
            checkStatus: product.check_status,
            stockType: product.stock_type,
            shippingMode: product.shipping_mode,
            isAlarming: diagnose?.is_alarming ?? sku.is_alarming ?? product.is_alarming ?? null,
            stockTags: product.tags ?? []
          }
        },
        warnings
      })
    }
  }

  return {
    pageIndex: response.page ?? 1,
    sourceUrl: input.sourceUrl,
    rows,
    mapping: buildDoudianHttpMappingPreview(response.data?.[0]),
    warnings: rows.flatMap((row) => row.warnings)
  }
}

async function fetchDiagnoseBySku(fetcher: Fetcher, products: readonly DoudianStockProduct[]): Promise<Map<string, DoudianStockDiagnoseRow>> {
  const diagnoseByKey = new Map<string, DoudianStockDiagnoseRow>()

  for (const product of products) {
    const productId = stringValue(product.product_id)
    const skuIds = (product.skus ?? []).map((sku) => stringValue(sku.sku_id)).filter(Boolean)
    if (!productId || skuIds.length === 0) continue

    const response = await postDoudianJson<DoudianStockDiagnoseResponse>(fetcher, diagnosePath, {
      product_id: productId,
      sku_ids: skuIds
    })

    for (const row of response.data ?? []) {
      diagnoseByKey.set(diagnoseKey(stringValue(row.product_id), stringValue(row.sku_id)), row)
    }
  }

  return diagnoseByKey
}

async function postDoudianJson<T>(fetcher: Fetcher, path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetcher(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`抖店接口请求失败：${path} HTTP ${response.status}`)
  }

  return (await response.json()) as T
}

function buildDoudianHttpMappingPreview(product?: DoudianStockProduct): FieldMappingPreview[] {
  const firstSku = product?.skus?.[0]
  return [
    previewItem("product_id + skus[].sku_id", "externalSkuId", firstSku?.sku_id ?? product?.product_id),
    previewItem("product_name + skus[].sku_name", "title", [product?.product_name, firstSku?.sku_name].filter(Boolean).join(" / ")),
    previewItem("无", "salePrice", undefined),
    previewItem("skus[].total_unoccupied_stock_num", "availableStock", firstSku?.total_unoccupied_stock_num ?? product?.total_unoccupied_stock_num),
    previewItem("category_id", "category", product?.category_id),
    previewItem("status / skus[].status", "listingStatus", firstSku?.status ?? product?.status)
  ]
}

function previewItem(sourceLabel: string, targetKey: FieldMappingPreview["targetKey"], value: unknown): FieldMappingPreview {
  const sampleValue = stringValue(value)
  return {
    sourceLabel: `抖店接口字段：${sourceLabel}`,
    targetKey,
    targetLabel: `标准字段：${targetKey}`,
    status: sampleValue ? "mapped" : "missing",
    sampleValue: sampleValue || "本页样例为空"
  }
}

function diagnoseKey(productId: string, skuId: string): string {
  return `${productId}:${skuId}`
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
