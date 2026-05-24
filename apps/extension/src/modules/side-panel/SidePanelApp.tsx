import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Info,
  MoreVertical,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Store,
  X
} from "lucide-react"

import {
  assertNoSensitivePayloadKeys,
  attachTaskSubmitReceipt,
  buildCommentIngestPayload,
  buildProductIngestPayload,
  collectAllCommentPages,
  collectAllProductPages,
  collectCommentPage,
  collectDoudianStockPages,
  collectProductPage,
  createInitialTaskState,
  emptySyntheticDoudianCommentPage,
  refreshTaskStatistics,
  recognizeCommentPage,
  recognizeProductPage,
  resetTaskState,
  submitToRealIngestApi,
  syntheticDoudianCommentPages,
  syntheticDoudianPages,
  unsupportedSyntheticPage
} from "../../lib/ingest"
import type { CollectablePageStatus, CollectionTaskState, RunStatus, SourceKind } from "../../schemas/ingest"
import styles from "./sidepanel.module.css"

type AutomationResponse<T> = { ok: true; data: T } | { ok: false; error: string }

interface DoudianStockAutomationResult {
  readonly sourceUrl: string
  readonly source?: "current-page-dom" | "stock-api"
  readonly previews: Awaited<ReturnType<typeof collectDoudianStockPages>>
}

interface PageSnapshot {
  readonly href: string
  readonly title: string
  readonly readyState: string
  readonly bodyTextSample: string
  readonly counts: {
    readonly buttons: number
    readonly fields: number
    readonly tables: number
  }
  readonly buttons: ReadonlyArray<Record<string, string>>
  readonly fields: ReadonlyArray<Record<string, string>>
  readonly tables: ReadonlyArray<Record<string, string>>
}

interface ChromeLike {
  tabs?: {
    query?: (queryInfo: { active: boolean; currentWindow: boolean }, callback: (tabs: Array<{ id?: number; url?: string }>) => void) => void
    sendMessage?: <T>(tabId: number, message: unknown, callback: (response?: AutomationResponse<T>) => void) => void
  }
  runtime?: {
    lastError?: { message?: string }
  }
}

function getChromeApi(): ChromeLike | undefined {
  return (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome
}

function sendToActiveTab<T>(message: unknown): Promise<T> {
  const chromeApi = getChromeApi()
  return new Promise((resolve, reject) => {
    chromeApi?.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId || !chromeApi.tabs?.sendMessage) {
        reject(new Error("未找到当前抖店页面；请在抖店 tab 中打开采集侧边栏。"))
        return
      }

      chromeApi.tabs.sendMessage<T>(tabId, message, (response) => {
        const lastError = chromeApi.runtime?.lastError?.message
        if (lastError) {
          reject(new Error(`页面脚本未响应：${lastError}。请刷新抖店页面后重试。`))
          return
        }
        if (!response) {
          reject(new Error("页面脚本未返回采集结果；请确认插件已刷新并授权抖店域名。"))
          return
        }
        if (!response.ok) {
          reject(new Error(response.error))
          return
        }
        resolve(response.data)
      })
    })
  })
}

function runStatusLabel(status: RunStatus) {
  const labels: Record<RunStatus, string> = {
    idle: "未开始",
    recognizing: "识别中",
    ready: "已就绪",
    collecting_products: "采集中",
    collecting_comments: "评论采集中",
    pausing: "暂停中",
    paused: "已暂停",
    submitting: "提交中",
    submitted: "已提交",
    failed: "失败",
    resetting: "已复位"
  }

  return labels[status]
}

function statusTone(status: RunStatus) {
  if (status === "submitted" || status === "ready") return "ready"
  if (status === "failed") return "failed"
  if (status === "idle" || status === "resetting") return "idle"
  return "running"
}

function recognitionLabel(status: CollectablePageStatus | undefined) {
  if (status === "collectible") return "已识别"
  if (status === "needs-confirmation") return "需确认"
  if (status === "unsupported") return "不支持"
  return "待识别"
}

function sourceKindLabel(sourceKind?: SourceKind) {
  return sourceKind === "comment" ? "评论" : "商品"
}

function progressValue(runState: CollectionTaskState) {
  if (runState.totalPages <= 0) return 0
  return Math.min(100, Math.round((runState.currentPage / runState.totalPages) * 100))
}

export function SidePanelApp() {
  const [activeProductPageIndex, setActiveProductPageIndex] = useState(0)
  const [activeCommentPageIndex] = useState(0)
  const [useUnsupportedPage, setUseUnsupportedPage] = useState(false)
  const [runState, setRunState] = useState<CollectionTaskState>(() => createInitialTaskState(Math.max(syntheticDoudianPages.length, syntheticDoudianCommentPages.length)))
  const [pageSnapshot, setPageSnapshot] = useState<PageSnapshot | undefined>()
  const [showDebug, setShowDebug] = useState(false)

  const activeProductPage = useUnsupportedPage ? unsupportedSyntheticPage : syntheticDoudianPages[activeProductPageIndex]
  const activeCommentPage = activeCommentPageIndex >= syntheticDoudianCommentPages.length ? emptySyntheticDoudianCommentPage : syntheticDoudianCommentPages[activeCommentPageIndex]
  const activeRecognition = runState.lastRecognition
  const productPayload = useMemo(() => buildProductIngestPayload(runState), [runState])
  const commentPayload = useMemo(() => buildCommentIngestPayload(runState), [runState])
  const progress = progressValue(runState)
  const hasProductRows = runState.collectedProductRows.length > 0
  const hasDebugData = Boolean(pageSnapshot)

  const submitRealPayloads = async () => {
    try {
      assertNoSensitivePayloadKeys(productPayload)
      assertNoSensitivePayloadKeys(commentPayload)
      setRunState((state) => ({ ...state, status: "submitting", lastEvent: "SUBMIT" }))
      if (productPayload.rows.length === 0) {
        throw new Error("没有可提交的商品采集记录；请先执行“采当前页DOM”或“库存采SKU”。")
      }
      const receipt = await submitToRealIngestApi(productPayload)
      setRunState((state) =>
        attachTaskSubmitReceipt(state, {
          ok: true,
          submitId: receipt.submitId,
          acceptedRows: receipt.acceptedRows,
          adapter: "real-api",
          message: "真实 POST /api/ingest 已接收商品 payload；后端负责归一化、诊断和 SKU 健康投影。"
        })
      )
    } catch (error) {
      setRunState((state) => ({
        ...state,
        status: "failed",
        lastEvent: "FAIL",
        lastError: error instanceof Error ? error.message : "真实 ingest API 提交失败。"
      }))
    }
  }

  const applyProductPreviews = (result: DoudianStockAutomationResult, emptyMessage: string) => {
    const previews = result.previews
    const rows = previews.flatMap((preview) => preview.rows)
    const lastPreview = previews[previews.length - 1]
    const pageType = result.source === "stock-api" ? "stock-api-sku-list" : "current-page-dom"
    setRunState((state) =>
      refreshTaskStatistics({
        ...state,
        status: rows.length > 0 ? "ready" : "failed",
        activePageType: rows.length > 0 ? "product-list" : "unsupported",
        currentPage: Math.max(previews.length, 1),
        totalPages: Math.max(previews.length, 1),
        collectedProductRows: rows,
        currentProductPreview: lastPreview,
        lastRecognition: {
          status: rows.length > 0 ? "collectible" : "unsupported",
          confidence: rows.length > 0 ? 0.92 : 0,
          platform: "抖店商家后台",
          pageType,
          sourceKind: "product",
          pageIndex: Math.max(previews.length, 1),
          totalPages: Math.max(previews.length, 1),
          reasons:
            rows.length > 0
              ? result.source === "stock-api"
                ? ["库存接口返回 SKU 维度数据", "SKU 数可能大于当前页商品数"]
                : ["当前页面 DOM 返回商品行", "包含销量、好评率、质量分等页面字段"]
              : [emptyMessage],
          unsupportedReason: rows.length > 0 ? undefined : emptyMessage
        },
        lastEvent: rows.length > 0 ? "PAGE_COLLECTED" : "FAIL",
        lastError: rows.length > 0 ? undefined : emptyMessage,
        checkpoint: undefined,
        submitted: false,
        submitReceipt: undefined
      })
    )
  }

  const collectProductRowsFromPageDom = async () => {
    try {
      setRunState((state) => ({ ...state, status: "collecting_products", lastEvent: "START", lastError: undefined }))
      const result = await sendToActiveTab<DoudianStockAutomationResult>({ type: "PICKAGENT_COLLECT_CURRENT_PAGE_DOM" })
      applyProductPreviews(result, "当前页面 DOM 未识别到商品行；请先点“页面调试”查看摘要。")
    } catch (error) {
      setRunState((state) => ({
        ...state,
        status: "failed",
        lastEvent: "FAIL",
        lastError: error instanceof Error ? error.message : "当前页面 DOM 采集失败；请确认已刷新抖店页面。"
      }))
    }
  }

  const collectRealDoudianStock = async () => {
    try {
      setRunState((state) => ({ ...state, status: "collecting_products", lastEvent: "START", lastError: undefined }))
      const result = await sendToActiveTab<DoudianStockAutomationResult>({
        type: "PICKAGENT_COLLECT_DOUDIAN_STOCK",
        pageSize: 50,
        maxPages: 20
      })
      applyProductPreviews(result, "真实抖店库存接口未返回可采集数据；请确认已登录并打开库存管理页。")
    } catch (error) {
      setRunState((state) => ({
        ...state,
        status: "failed",
        lastEvent: "FAIL",
        lastError: error instanceof Error ? error.message : "真实抖店库存接口采集失败；请确认已登录抖店并授权插件访问。"
      }))
    }
  }

  const inspectCurrentPage = async () => {
    try {
      setRunState((state) => ({ ...state, status: "recognizing", lastEvent: "PAGE_RECOGNIZED", lastError: undefined }))
      const snapshot = await sendToActiveTab<PageSnapshot>({ type: "PICKAGENT_PAGE_SNAPSHOT" })
      setPageSnapshot(snapshot)
      setShowDebug(true)
      setRunState((state) =>
        refreshTaskStatistics({
          ...state,
          status: "ready",
          activePageType: snapshot.href.includes("fxg.jinritemai.com") ? "product-list" : "unsupported",
          lastRecognition: {
            status: snapshot.href.includes("fxg.jinritemai.com") ? "needs-confirmation" : "unsupported",
            confidence: snapshot.href.includes("fxg.jinritemai.com") ? 0.66 : 0,
            platform: "抖店商家后台",
            pageType: "page-dom-snapshot",
            sourceKind: "product",
            pageIndex: 1,
            totalPages: 1,
            reasons: [`URL: ${snapshot.href}`, `buttons=${snapshot.counts.buttons}`, `fields=${snapshot.counts.fields}`, `tables=${snapshot.counts.tables}`],
            unsupportedReason: snapshot.href.includes("fxg.jinritemai.com") ? undefined : "当前 tab 不是抖店页面。"
          },
          lastEvent: "PAGE_RECOGNIZED",
          lastError: undefined
        })
      )
    } catch (error) {
      setRunState((state) => ({
        ...state,
        status: "failed",
        lastEvent: "FAIL",
        lastError: error instanceof Error ? error.message : "页面 DOM 调试失败。"
      }))
    }
  }

  const resetRun = () => {
    setPageSnapshot(undefined)
    setShowDebug(false)
    setRunState(resetTaskState(Math.max(syntheticDoudianPages.length, syntheticDoudianCommentPages.length)))
  }

  const quickMetrics = [
    { label: "商品", value: runState.statistics.productCount, tone: "ready" },
    { label: "SKU", value: runState.statistics.skuCount, tone: "ready" },
    { label: "评论", value: runState.statistics.commentCount, tone: "idle" },
    { label: "异常", value: runState.statistics.warningRowCount, tone: runState.statistics.warningRowCount > 0 ? "warn" : "idle" }
  ]

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>■</div>
          <span>SKU Ready Agent</span>
        </div>
        <div className={styles.headerActions}>
          <ExternalLink size={16} />
          <MoreVertical size={16} />
          <X size={16} />
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.card}>
          <div className={styles.cardPadding}>
            <div className={styles.taskHeader}>
              <div className={styles.taskTitleRow}>
                <div className={styles.taskIcon}>
                  <FileText size={16} />
                </div>
                <div>
                  <div className={styles.taskName}>
                    执行抖店商品采集 <ChevronDown size={14} />
                  </div>
                  <div className={styles.taskMetaInline}>Run: {runState.runId}</div>
                </div>
              </div>
              <div className={`${styles.runBadge} ${styles[`runBadge_${statusTone(runState.status)}`]}`}>{runStatusLabel(runState.status)}</div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardPadding}>
            <div className={styles.sectionTitle}>
              页面检测
              <div className={styles.sectionTitleMeta}>
                <CheckCircle2 size={12} />
                仅读取当前授权页面字段
              </div>
            </div>
            <div className={styles.dataRow}>
              <Globe size={14} className={styles.dataIcon} />
              <div className={styles.dataLabel}>当前页面</div>
              <div className={styles.dataValue}>
                {activeRecognition?.pageType ?? "待检测"}
                <span className={`${styles.statusPill} ${styles[`statusPill_${activeRecognition?.status ?? "idle"}`]}`}>{recognitionLabel(activeRecognition?.status)}</span>
              </div>
            </div>
            <div className={styles.dataRow}>
              <Store size={14} className={styles.dataIcon} />
              <div className={styles.dataLabel}>来源</div>
              <div className={styles.dataValue}>{activeRecognition ? `${activeRecognition.platform} · ${sourceKindLabel(activeRecognition.sourceKind)}` : "抖店当前 tab"}</div>
            </div>
            <div className={styles.dataRow}>
              <ShieldCheck size={14} className={styles.dataIcon} />
              <div className={styles.dataLabel}>已解析</div>
              <div className={styles.dataValue}>
                商品 {runState.statistics.productCount} / SKU {runState.statistics.skuCount}
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardPadding}>
            <div className={styles.sectionTitle}>运行状态</div>
            <div className={styles.progressContainer}>
              <div className={styles.progressHeader}>
                <span>扫描进度</span>
                <span>{progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className={styles.metricsGrid}>
              {quickMetrics.map((metric) => (
                <div className={styles.metricItem} key={metric.label}>
                  <div className={`${styles.metricValue} ${styles[`metric_${metric.tone}`]}`}>{metric.value}</div>
                  <div className={styles.metricLabel}>{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardPadding}>
            <div className={styles.sectionTitle}>
              采集操作
              <span className={styles.sectionHint}>DOM 对齐当前页，库存接口为 SKU 维度</span>
            </div>
            <div className={styles.actionGrid}>
              <button className={styles.buttonPrimary} type="button" onClick={() => void collectProductRowsFromPageDom()}>
                <Search size={16} />
                采当前页DOM
              </button>
              <button className={styles.buttonSecondary} type="button" onClick={() => void collectRealDoudianStock()}>
                <Store size={16} />
                库存采SKU
              </button>
              <button className={styles.buttonSecondary} type="button" onClick={() => void inspectCurrentPage()}>
                <Info size={16} />
                页面调试
              </button>
              <button className={styles.buttonSecondary} type="button" onClick={() => void submitRealPayloads()} disabled={!hasProductRows}>
                <Send size={16} />
                上报服务端
              </button>
            </div>
            <div className={styles.secondaryActionRow}>
              <button className={styles.textButton} type="button" onClick={() => setRunState(recognizeProductPage(runState, activeProductPage))}>
                识别商品页
              </button>
              <button className={styles.textButton} type="button" onClick={() => setRunState(recognizeCommentPage(runState, activeCommentPage))}>
                识别评论页
              </button>
              <button className={styles.textButton} type="button" onClick={resetRun}>
                <RotateCcw size={13} />
                复位
              </button>
            </div>
            {runState.lastError ? <div className={styles.inlineWarning}>{runState.lastError}</div> : null}
            {runState.submitReceipt ? <div className={styles.inlineSuccess}>{runState.submitReceipt.message}</div> : null}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardPadding}>
            <div className={styles.sectionTitle}>
              关键发现
              <button className={styles.linkButton} type="button" onClick={() => setShowDebug((value) => !value)}>
                {showDebug ? "收起" : "查看日志"} <ChevronRight size={14} />
              </button>
            </div>
            <div className={styles.issueRow}>
              <div className={styles.issueLeft}>
                <AlertTriangle size={14} className={`${styles.issueIcon} ${styles.orange}`} />
                <span className={styles.issueLabel}>异常字段</span>
                <span className={styles.issueDesc}>缺库存、价格、好评率等字段</span>
              </div>
              <div className={`${styles.issueCount} ${styles.orange}`}>{runState.statistics.warningRowCount}</div>
            </div>
            <div className={styles.issueRow}>
              <div className={styles.issueLeft}>
                <Info size={14} className={`${styles.issueIcon} ${styles.blue}`} />
                <span className={styles.issueLabel}>页面快照</span>
                <span className={styles.issueDesc}>按钮/输入框/表格摘要</span>
              </div>
              <div className={`${styles.issueCount} ${styles.blue}`}>{hasDebugData ? 1 : 0}</div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardPadding}>
            <div className={styles.sectionTitle}>运行步骤</div>
            <div className={styles.stepper}>
              <div className={styles.step}>
                <div className={`${styles.stepIcon} ${activeRecognition ? styles.completed : ""}`}>{activeRecognition ? <CheckCircle2 size={12} /> : "1"}</div>
                <div className={styles.stepLabel}>检测</div>
                <div className={`${styles.stepLine} ${activeRecognition ? styles.completed : styles.dashed}`} />
              </div>
              <div className={styles.step}>
                <div className={`${styles.stepIcon} ${hasProductRows ? styles.completed : ""}`}>{hasProductRows ? <CheckCircle2 size={12} /> : "2"}</div>
                <div className={styles.stepLabel}>采集</div>
                <div className={`${styles.stepLine} ${hasProductRows ? styles.completed : styles.dashed}`} />
              </div>
              <div className={styles.step}>
                <div className={`${styles.stepIcon} ${runState.submitted ? styles.completed : styles.running}`}>3</div>
                <div className={styles.stepLabel}>上报</div>
              </div>
            </div>
          </div>
        </section>

        {showDebug ? (
          <section className={styles.card}>
            <div className={styles.cardPadding}>
              <div className={styles.sectionTitle}>
                页面 DOM 调试
                <span className={styles.sectionHint}>{pageSnapshot?.readyState ?? "暂无快照"}</span>
              </div>
              <div className={styles.debugBox}>
                <div>URL: {pageSnapshot?.href ?? "未采集"}</div>
                <div>按钮: {pageSnapshot?.counts.buttons ?? 0} / 输入框: {pageSnapshot?.counts.fields ?? 0} / 表格: {pageSnapshot?.counts.tables ?? 0}</div>
                <div>候选按钮: {pageSnapshot?.buttons.slice(0, 10).map((item) => item.text || item.ariaLabel || item.title).filter(Boolean).join(" / ") || "无"}</div>
                <div>文本样本: {pageSnapshot?.bodyTextSample.slice(0, 320) ?? "点击页面调试后显示。"}</div>
              </div>
            </div>
          </section>
        ) : null}

        <section className={styles.card}>
          <div className={styles.configRow}>
            <div className={styles.configTitle}>
              <Settings size={14} />
              配置与适配器
            </div>
            <div className={styles.configValue}>已选择: 抖店 <ChevronDown size={14} /></div>
          </div>
          <div className={styles.devTools}>
            <button className={styles.textButton} type="button" onClick={() => setRunState(collectProductPage(runState, activeProductPage))}>
              模拟采商品
            </button>
            <button className={styles.textButton} type="button" onClick={() => setRunState(collectCommentPage(runState, activeCommentPage))}>
              模拟采评论
            </button>
            <button className={styles.textButton} type="button" onClick={() => setRunState(collectAllProductPages(createInitialTaskState(syntheticDoudianPages.length), syntheticDoudianPages, 1))}>
              暂停样例
            </button>
            <button className={styles.textButton} type="button" onClick={() => setRunState(collectAllProductPages(runState, syntheticDoudianPages.slice(runState.currentPage)))}>
              继续商品
            </button>
            <button className={styles.textButton} type="button" onClick={() => setRunState(collectAllCommentPages(runState, syntheticDoudianCommentPages.slice(Math.max(0, runState.currentPage - 1))))}>
              继续评论
            </button>
            <button className={styles.textButton} type="button" onClick={() => setUseUnsupportedPage((value) => !value)}>
              切换异常
            </button>
            <button className={styles.textButton} type="button" onClick={() => setActiveProductPageIndex((index) => (index + 1) % syntheticDoudianPages.length)}>
              换样例页
            </button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.securityBadge}>
          <ShieldCheck size={14} />
          <span>安全传输中</span>
          <div className={styles.securityDot} />
        </div>
        <div className={styles.helpLink}>
          帮助 <HelpCircle size={14} />
        </div>
      </footer>
    </div>
  )
}
