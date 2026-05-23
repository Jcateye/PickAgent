import type { CanonicalRuleDto, IngestPayloadDto, IngestRowDto } from "../../../../contracts/types/businessFoundation";

type HttpRecord = {
  capturedAt?: string;
  method?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  tabUrl?: string;
  url?: string;
};

type StockListProduct = {
  product_id?: string;
  product_name?: string;
  category_id?: number;
  status?: number;
  check_status?: number;
  total_stock_num?: number;
  total_unoccupied_stock_num?: number;
  total_occupied_stock_num?: number;
  spot_stock_num?: number;
  future_stock_num?: number;
  is_alarming?: boolean;
  tags?: string[];
  skus?: StockListSku[];
};

type StockListSku = {
  sku_id?: string;
  sku_name?: string;
  status?: number;
  total_stock_num?: number;
  total_unoccupied_stock_num?: number;
  total_occupied_stock_num?: number;
  spot_stock_num?: number;
  future_stock_num?: number;
  is_alarming?: boolean;
  forbid_edit?: boolean;
  forbid_edit_reason?: string;
};

type StockDiagnoseRow = {
  product_id?: string;
  sku_id?: string;
  is_alarming?: boolean;
};

type BusinessClue = {
  clue_detail?: {
    clue_id?: number;
    name?: string;
    category_path?: string[];
    price_min?: number;
    price_max?: number;
    urgent_recruitment_tag?: boolean;
    clue_submit_requirements?: unknown;
    clue_label_list?: Array<{ label_name?: string; label_desc?: string }>;
  };
};

export type DouyinBusinessHttpMapping = {
  ingestPayload: IngestPayloadDto;
  businessChanceRules: CanonicalRuleDto[];
  sourceEndpoints: Array<{
    endpoint: string;
    fieldMapping: Record<string, string>;
  }>;
};

export function mapDouyinBusinessHttpRecords(records: HttpRecord[], input?: { storeId?: string; collectedAt?: string }): DouyinBusinessHttpMapping {
  const stockProducts = stockListProducts(records);
  const diagnoseBySku = new Map(stockDiagnoseRows(records).map((row) => [String(row.sku_id), row]));
  const rows: IngestRowDto[] = [];

  stockProducts.forEach((product, productIndex) => {
    const skus = product.skus?.length ? product.skus : [{ sku_id: product.product_id, sku_name: product.product_name }];
    skus.forEach((sku, skuIndex) => {
      const diagnose = sku.sku_id ? diagnoseBySku.get(String(sku.sku_id)) : undefined;
      rows.push({
        platform: "douyin_fxg",
        storeId: input?.storeId ?? "fxg_unknown_store",
        externalSkuId: String(sku.sku_id ?? product.product_id ?? `unknown_${productIndex}_${skuIndex}`),
        productName: [product.product_name, sku.sku_name].filter(Boolean).join(" / ") || undefined,
        category: product.category_id === undefined ? undefined : String(product.category_id),
        sourceUrl: firstEndpoint(records, "/stock/manage/list"),
        rowIndex: rows.length,
        stock: numberOrUndefined(sku.total_unoccupied_stock_num ?? sku.total_stock_num ?? product.total_unoccupied_stock_num ?? product.total_stock_num),
        certificateStatus: product.check_status === 3 ? "valid" : product.check_status === undefined ? undefined : "needs_review",
        raw: {
          product,
          sku,
          stockDiagnose: diagnose,
          fxg: {
            productId: product.product_id,
            skuId: sku.sku_id,
            productStatus: product.status,
            skuStatus: sku.status,
            checkStatus: product.check_status,
            isAlarming: diagnose?.is_alarming ?? sku.is_alarming ?? product.is_alarming,
            forbidEdit: sku.forbid_edit,
            forbidEditReason: sku.forbid_edit_reason,
            stockTags: product.tags,
          },
        },
      });
    });
  });

  return {
    ingestPayload: {
      connectorId: "connector_douyin_fxg_http_capture",
      collectedAt: input?.collectedAt ?? latestCapturedAt(records) ?? new Date().toISOString(),
      rows,
    },
    businessChanceRules: businessChanceRules(records),
    sourceEndpoints: [
      {
        endpoint: "POST /stock/manage/list",
        fieldMapping: {
          product_id: "raw.fxg.productId",
          product_name: "productName",
          "skus[].sku_id": "externalSkuId",
          "skus[].sku_name": "productName suffix",
          "skus[].total_unoccupied_stock_num": "stock",
          total_unoccupied_stock_num: "fallback stock",
          check_status: "certificateStatus",
          tags: "raw.fxg.stockTags",
        },
      },
      {
        endpoint: "POST /stock/manage/sku_stock_diagnose",
        fieldMapping: {
          product_id: "raw.stockDiagnose.product_id",
          sku_id: "raw.stockDiagnose.sku_id",
          is_alarming: "raw.fxg.isAlarming",
        },
      },
      {
        endpoint: "POST /api/commop/business_chance_center/clue/common/real_time_list",
        fieldMapping: {
          "clue_detail.name": "businessChanceRules[].message",
          "clue_detail.category_path": "businessChanceRules[].field category hint",
          "clue_detail.price_min/price_max": "businessChanceRules[] price threshold hint",
          "clue_detail.clue_label_list": "businessChanceRules[] evidence labels",
        },
      },
    ],
  };
}

function stockListProducts(records: HttpRecord[]): StockListProduct[] {
  return records.flatMap((record) => {
    if (!record.url?.includes("/stock/manage/list")) return [];
    const body = parseBody(record.responseBody);
    return Array.isArray(body?.data) ? (body.data as StockListProduct[]) : [];
  });
}

function stockDiagnoseRows(records: HttpRecord[]): StockDiagnoseRow[] {
  return records.flatMap((record) => {
    if (!record.url?.includes("/stock/manage/sku_stock_diagnose")) return [];
    const body = parseBody(record.responseBody);
    return Array.isArray(body?.data) ? (body.data as StockDiagnoseRow[]) : [];
  });
}

function businessChanceRules(records: HttpRecord[]): CanonicalRuleDto[] {
  const clues = records.flatMap((record) => {
    if (!record.url?.includes("/business_chance_center/clue/common/real_time_list")) return [];
    const body = parseBody(record.responseBody);
    return Array.isArray(body?.data) ? (body.data as BusinessClue[]) : [];
  });

  return clues.slice(0, 5).map((clue, index) => {
    const detail = clue.clue_detail;
    const labels = detail?.clue_label_list?.map((label) => label.label_name).filter(Boolean).join("、");
    return {
      id: `business_chance_${detail?.clue_id ?? index}`,
      type: "manual_review",
      message: `商机线索：${detail?.name ?? "未命名线索"}${labels ? `（${labels}）` : ""}`,
      severity: detail?.urgent_recruitment_tag ? "blocking" : "warning",
    };
  });
}

function parseBody(body: unknown): { data?: unknown } | undefined {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as { data?: unknown };
    } catch {
      return undefined;
    }
  }
  return body && typeof body === "object" ? (body as { data?: unknown }) : undefined;
}

function latestCapturedAt(records: HttpRecord[]): string | undefined {
  return records.map((record) => record.capturedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
}

function firstEndpoint(records: HttpRecord[], path: string): string | undefined {
  return records.find((record) => record.url?.includes(path))?.url;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
