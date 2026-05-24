import { useMemo, useState } from "react"

import {
  assertNoSensitivePayloadKeys,
  attachTaskSubmitReceipt,
  buildCommentIngestPayload,
  buildProductIngestPayload,
  collectDoudianStockPages,
  collectAllCommentPages,
  collectAllProductPages,
  collectCommentPage,
  collectProductPage,
  createInitialTaskState,
  defaultRealIngestEndpoint,
  emptySyntheticDoudianCommentPage,
  realIngestAdapterDependency,
  refreshTaskStatistics,
  recognizeCommentPage,
  recognizeProductPage,
  resetTaskState,
  submitToRealIngestApi,
  syntheticDoudianCommentPages,
  syntheticDoudianPages,
  unsupportedSyntheticPage
} from "../../lib/ingest"
import type { CollectionTaskState, CollectablePageStatus, RunStatus, SourceKind, SubmitReceipt } from "../../schemas/ingest"
import { CollapsibleSection } from "../../shared/ui/CollapsibleSection"
import { ModuleCard } from "../../shared/ui/ModuleCard"
import { SecurityNote } from "../../shared/ui/SecurityNote"
import { StatusBadge } from "../../shared/ui/StatusBadge"

type PreviewTab = "products" | "comments"

function recognitionTone(status: CollectablePageStatus | undefined) {
  if (status === "collectible") return "ready" as const
  if (status === "needs-confirmation") return "review" as const
  return "blocked" as const
}

function runTone(status: RunStatus) {
  if (status === "submitted" || status === "ready") return "ready" as const
  if (status === "failed") return "blocked" as const
  if (status === "paused" || status === "pausing") return "review" as const
  return "repair" as const
}

function runStatusLabel(status: RunStatus) {
  const labels: Record<RunStatus, string> = {
    idle: "未开始",
    recognizing: "识别中",
    ready: "已就绪",
    collecting_products: "商品采集中",
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

function sourceKindLabel(sourceKind?: SourceKind) {
  return sourceKind === "comment" ? "评论" : "商品"
}

function progressValue(runState: CollectionTaskState) {
  if (runState.totalPages <= 0) return 0
  return Math.min(100, Math.round((runState.currentPage / runState.totalPages) * 100))
}

function mockCombinedReceipt(runState: CollectionTaskState): SubmitReceipt {
  return {
    ok: true,
    submitId: `MOCK-DUAL-${runState.runId}`,
    acceptedRows: runState.collectedProductRows.length + runState.collectedCommentRows.length,
    adapter: "mock",
    message: "mock submit adapter 已接收商品和评论采集 payload；真实后端统计投影仍由 ingest service 更新。"
  }
}

export function SidePanelApp() {
  const [activeProductPageIndex, setActiveProductPageIndex] = useState(0)
  const [activeCommentPageIndex, setActiveCommentPageIndex] = useState(0)
  const [useUnsupportedPage, setUseUnsupportedPage] = useState(false)
  const [previewTab, setPreviewTab] = useState<PreviewTab>("products")
  const [runState, setRunState] = useState<CollectionTaskState>(() => createInitialTaskState(Math.max(syntheticDoudianPages.length, syntheticDoudianCommentPages.length)))

  const activeProductPage = useUnsupportedPage ? unsupportedSyntheticPage : syntheticDoudianPages[activeProductPageIndex]
  const activeCommentPage = activeCommentPageIndex >= syntheticDoudianCommentPages.length ? emptySyntheticDoudianCommentPage : syntheticDoudianCommentPages[activeCommentPageIndex]
  const activeRecognition = runState.lastRecognition
  const productPayload = useMemo(() => buildProductIngestPayload(runState), [runState])
  const commentPayload = useMemo(() => buildCommentIngestPayload(runState), [runState])

  const submitRealPayloads = async () => {
    try {
      assertNoSensitivePayloadKeys(productPayload)
      assertNoSensitivePayloadKeys(commentPayload)
      setRunState((state) => ({ ...state, status: "submitting", lastEvent: "SUBMIT" }))
      if (productPayload.rows.length === 0) {
        throw new Error("没有可提交的商品采集记录；请先完成库存页采集。")
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

  const collectRealDoudianStock = async () => {
    try {
      setRunState((state) => ({ ...state, status: "collecting_products", lastEvent: "START", lastError: undefined }))
      const sourceUrl = "https://fxg.jinritemai.com/ffa/g/stock-manage/list"
      const previews = await collectDoudianStockPages({ sourceUrl, pageSize: 50, maxPages: 20 })
      const rows = previews.flatMap((preview) => preview.rows)
      const lastPreview = previews[previews.length - 1]
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
            pageType: rows.length > 0 ? "stock-manage-list" : "unsupported",
            sourceKind: "product",
            pageIndex: Math.max(previews.length, 1),
            totalPages: Math.max(previews.length, 1),
            reasons: rows.length > 0 ? ["抖店库存接口返回商品/SKU数据", "已调用库存诊断接口补充采集风险"] : ["抖店库存接口未返回可采集数据"],
            unsupportedReason: rows.length > 0 ? undefined : "抖店库存接口未返回商品/SKU数据。"
          },
          lastEvent: rows.length > 0 ? "PAGE_COLLECTED" : "FAIL",
          lastError: rows.length > 0 ? undefined : "真实抖店库存接口未返回可采集数据；请确认已登录并打开库存管理页。",
          checkpoint: undefined,
          submitted: false,
          submitReceipt: undefined
        })
      )
    } catch (error) {
      setRunState((state) => ({
        ...state,
        status: "failed",
        lastEvent: "FAIL",
        lastError: error instanceof Error ? error.message : "真实抖店库存采集失败；请确认已登录抖店并授权插件访问。"
      }))
    }
  }

  const summary = [
    { label: "商品数", value: String(runState.statistics.productCount), tone: "ready" as const },
    { label: "SKU 数", value: String(runState.statistics.skuCount), tone: "ready" as const },
    { label: "评论数", value: String(runState.statistics.commentCount), tone: "repair" as const },
    { label: "低分/差评", value: `${runState.statistics.lowRatingCount}/${runState.statistics.negativeCommentCount}`, tone: runState.statistics.negativeCommentCount > 0 ? ("review" as const) : ("ready" as const) },
    { label: "未回复", value: String(runState.statistics.unrepliedCommentCount), tone: runState.statistics.unrepliedCommentCount > 0 ? ("review" as const) : ("ready" as const) },
    { label: "异常字段行", value: String(runState.statistics.warningRowCount), tone: runState.statistics.warningRowCount > 0 ? ("review" as const) : ("ready" as const) },
    { label: "已采页", value: String(runState.statistics.collectedPageCount), tone: "repair" as const },
    { label: "失败页", value: String(runState.statistics.failedPageCount), tone: runState.statistics.failedPageCount > 0 ? ("blocked" as const) : ("ready" as const) }
  ]

  return (
    <div className="plugin-root sidepanel-root">
      <section className="sidepanel-shell">
        <header className="sidepanel-shell__top">
          <div className="sidepanel-shell__topbar">
            <div className="sidepanel-shell__title-wrap">
              <div className="logo-badge">SR</div>
              <div>
                <h1 className="sidepanel-shell__title">SKU Ready Agent</h1>
                <p className="sidepanel-shell__subtitle">抖店双页面采集任务执行器</p>
              </div>
            </div>
            <StatusBadge tone={runTone(runState.status)}>{runStatusLabel(runState.status)}</StatusBadge>
          </div>

          <div className="sidepanel-hero">
            <div className="sidepanel-hero__card">
              <div className="sidepanel-hero__eyebrow">当前任务</div>
              <div className="sidepanel-hero__headline">
                {activeRecognition ? `${activeRecognition.platform} · ${activeRecognition.pageType}` : "等待页面识别"}
              </div>
              <div className="sidepanel-hero__detail">
                {activeRecognition
                  ? `第 ${activeRecognition.pageIndex} / ${activeRecognition.totalPages} 页 · ${sourceKindLabel(activeRecognition.sourceKind)} · 置信度 ${Math.round(activeRecognition.confidence * 100)}%`
                  : "支持商品列表页 /ffa/g/list 与评价管理页 /ffa/maftersale/comment。"}
              </div>
            </div>
            <div className="sidepanel-hero__metrics">
              <div className="hero-metric">
                <div className="hero-metric__label">采集事实</div>
                <div className="hero-metric__value">{runState.collectedProductRows.length + runState.collectedCommentRows.length}</div>
                <div className="hero-metric__note">插件不生成业务结论</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric__label">运行进度</div>
                <div className="hero-metric__value">{progressValue(runState)}%</div>
                <div className="hero-metric__note">可暂停、恢复、复位</div>
              </div>
            </div>
          </div>
        </header>

        <div className="sidepanel-shell__body">
          <ModuleCard
            title="页面识别与安全边界"
            right={<StatusBadge tone={recognitionTone(activeRecognition?.status)}>{activeRecognition?.status === "collectible" ? "可采集页面" : "待识别"}</StatusBadge>}
          >
            <div className="recognition-layout">
              <div>
                <h2 className="recognition-layout__title">识别依据摘要</h2>
                <p className="muted-text">混合优先策略：当前授权页面上下文接口/监听优先，DOM 点击翻页和解析兜底。</p>
                <div className="recognition-layout__grid">
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">商品页 URL</div>
                    <div className="recognition-layout__fact-value">{activeProductPage.url}</div>
                  </div>
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">评论页 URL</div>
                    <div className="recognition-layout__fact-value">{activeCommentPage.url}</div>
                  </div>
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">命中规则</div>
                    <div className="recognition-layout__fact-value">{activeRecognition?.reasons.join(" / ") ?? "尚未识别"}</div>
                  </div>
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">checkpoint</div>
                    <div className="recognition-layout__fact-value">
                      {runState.checkpoint ? `${runState.checkpoint.pageType} 下一页 ${runState.checkpoint.nextPageIndex}` : "无"}
                    </div>
                  </div>
                </div>
              </div>
              <SecurityNote title="安全边界" text="不读取 Cookie / Token，不自动改价、回复评论或修改商品；评论统计只作为后端诊断输入。" />
            </div>
          </ModuleCard>

          <ModuleCard title="任务控制" right={<span className="muted-text">状态机事件：{runState.lastEvent ?? "none"}</span>}>
            <div className="scan-card">
              <div className="scan-card__cta">
                <div>
                  <h2 className="scan-card__title">商品与评论双采集</h2>
                  <p className="muted-text">可先单页识别，再自动翻页采集；结构异常、限流或人工暂停会保留 checkpoint。</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setRunState(recognizeProductPage(runState, activeProductPage))}>
                  识别商品页
                </button>
              </div>
              <div className="button-row button-row--four">
                <button className="secondary-button" type="button" onClick={() => setRunState(recognizeCommentPage(runState, activeCommentPage))}>
                  识别评论页
                </button>
                <button className="secondary-button" type="button" onClick={() => setRunState(collectProductPage(runState, activeProductPage))}>
                  采当前商品页
                </button>
                <button className="secondary-button" type="button" onClick={() => setRunState(collectCommentPage(runState, activeCommentPage))}>
                  采当前评论页
                </button>
                <button className="secondary-button" type="button" onClick={() => setUseUnsupportedPage((value) => !value)}>
                  切换异常页
                </button>
              </div>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={() => void collectRealDoudianStock()}>
                  真实采集库存页
                </button>
                <button className="secondary-button" type="button" onClick={() => setRunState(collectAllProductPages(createInitialTaskState(syntheticDoudianPages.length), syntheticDoudianPages, 1))}>
                  商品采集后暂停
                </button>
                <button className="secondary-button" type="button" onClick={() => setRunState(collectAllProductPages(runState, syntheticDoudianPages.slice(runState.currentPage)))}>
                  继续商品采集
                </button>
                <button className="secondary-button" type="button" onClick={() => setRunState(collectAllCommentPages(runState, syntheticDoudianCommentPages.slice(Math.max(0, runState.currentPage - 1))))}>
                  继续评论采集
                </button>
              </div>
              <div>
                <div className="scan-card__progress-head">
                  <span className="scan-card__progress-label">运行总进度</span>
                  <span className="muted-text">第 {runState.currentPage} / {runState.totalPages} 页 · 状态 {runStatusLabel(runState.status)}</span>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${progressValue(runState)}%` }} />
                </div>
              </div>
              {runState.lastError ? <div className="inline-warning">{runState.lastError}</div> : null}
            </div>
          </ModuleCard>

          <ModuleCard title="状态机时间线" right={<StatusBadge tone={runTone(runState.status)}>{runStatusLabel(runState.status)}</StatusBadge>}>
            <div className="timeline-card">
              <div className="timeline-card__head">
                <div>
                  <h2 className="timeline-card__title">当前采集 Run：{runState.runId}</h2>
                  <p className="muted-text">记录页面识别、翻页、暂停、复位和提交状态；这些状态只用于采集流程控制。</p>
                </div>
                <div className="timeline-card__meta">
                  <span className="timeline-chip">商品 {runState.collectedProductRows.length}</span>
                  <span className="timeline-chip">评论 {runState.collectedCommentRows.length}</span>
                  <span className="timeline-chip">已提交 {runState.submitted ? "是" : "否"}</span>
                </div>
              </div>
              <div className="timeline-list">
                <article className={`timeline-step timeline-step--${activeRecognition ? "done" : "waiting"}`}>
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">页面识别</div>
                    <div className="timeline-step__time">{activeRecognition?.pageType ?? "等待"}</div>
                  </div>
                  <p className="muted-text">{activeRecognition?.reasons.join("；") ?? "点击识别按钮后开始任务。"}</p>
                </article>
                <article className={`timeline-step timeline-step--${runState.collectedProductRows.length > 0 ? "done" : "waiting"}`}>
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">商品采集</div>
                    <div className="timeline-step__time">{runState.collectedProductRows.length} 条</div>
                  </div>
                  <p className="muted-text">商品 ID、SKU、价格、库存、类目、状态、活动标签和更新时间作为采集事实保留。</p>
                </article>
                <article className={`timeline-step timeline-step--${runState.collectedCommentRows.length > 0 ? "done" : "waiting"}`}>
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">评论采集</div>
                    <div className="timeline-step__time">{runState.collectedCommentRows.length} 条</div>
                  </div>
                  <p className="muted-text">评分、内容摘要、售后/追评/差评标记和回复状态仅作为后端统计输入。</p>
                </article>
                <article className={`timeline-step timeline-step--${runState.status === "paused" ? "active" : "waiting"}`}>
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">暂停与恢复</div>
                    <div className="timeline-step__time">{runState.checkpoint ? `下一页 ${runState.checkpoint.nextPageIndex}` : "无 checkpoint"}</div>
                  </div>
                  <p className="muted-text">{runState.lastError ?? "未遇到限流、结构变化或人工暂停。"}</p>
                </article>
              </div>
            </div>
          </ModuleCard>

          <ModuleCard title="实时统计" right={<span className="muted-text">采集层指标</span>}>
            <div className="summary-grid summary-grid--wide">
              {summary.map((metric) => (
                <div className="summary-metric" key={metric.label}>
                  <div className={`summary-metric__value summary-metric__value--${metric.tone}`}>{metric.value}</div>
                  <div className="summary-metric__label">{metric.label}</div>
                </div>
              ))}
            </div>
          </ModuleCard>

          <section className="module-card">
            <div className="tab-row">
              <button className={`tab-button ${previewTab === "products" ? "tab-button--active" : ""}`} type="button" onClick={() => setPreviewTab("products")}>
                商品预览
              </button>
              <button className={`tab-button ${previewTab === "comments" ? "tab-button--active" : ""}`} type="button" onClick={() => setPreviewTab("comments")}>
                评论预览
              </button>
            </div>

            {previewTab === "products" ? (
              <>
                <CollapsibleSection title="商品字段映射" meta={`${runState.currentProductPreview?.mapping.length ?? 0} 个标准字段`}>
                  <div className="mapping-list">
                    {(runState.currentProductPreview?.mapping ?? []).map((row) => (
                      <div className="mapping-row" key={row.targetKey}>
                        <div>
                          <div className="mapping-row__title">{row.sourceLabel}</div>
                          <div className="mapping-row__subtle">样例：{row.sampleValue}</div>
                        </div>
                        <div className="mapping-row__arrow">-&gt;</div>
                        <div>
                          <div className="mapping-row__title">{row.targetLabel}</div>
                          <div className="mapping-row__subtle">{row.status === "mapped" ? "已映射" : "本页样例缺失"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="商品记录预览" meta={`${runState.collectedProductRows.length} 条`}>
                  <div className="preview-table">
                    <div className="preview-table__row preview-table__row--head">
                      <span>SKU</span>
                      <span>标题</span>
                      <span>价格</span>
                      <span>库存</span>
                      <span>提示</span>
                    </div>
                    {runState.collectedProductRows.map((row) => (
                      <div className="preview-table__row" key={`${row.rowIndex}-${row.externalSkuId}`}>
                        <span>{row.externalSkuId || "缺失"}</span>
                        <span>{row.title || "缺失"}</span>
                        <span>{row.salePrice ?? "空"}</span>
                        <span>{row.availableStock ?? "空"}</span>
                        <span>{row.warnings.length ? row.warnings.join("；") : "无"}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </>
            ) : (
              <>
                <CollapsibleSection title="评论字段映射" meta={`${runState.currentCommentPreview?.mapping.length ?? 0} 个标准字段`}>
                  <div className="mapping-list">
                    {(runState.currentCommentPreview?.mapping ?? []).map((row) => (
                      <div className="mapping-row" key={row.targetKey}>
                        <div>
                          <div className="mapping-row__title">{row.sourceLabel}</div>
                          <div className="mapping-row__subtle">样例：{row.sampleValue}</div>
                        </div>
                        <div className="mapping-row__arrow">-&gt;</div>
                        <div>
                          <div className="mapping-row__title">{row.targetLabel}</div>
                          <div className="mapping-row__subtle">{row.status === "mapped" ? "已映射" : "本页样例缺失"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="评论记录预览" meta={`${runState.collectedCommentRows.length} 条`}>
                  <div className="preview-table preview-table--comments">
                    <div className="preview-table__row preview-table__row--head">
                      <span>评论</span>
                      <span>商品</span>
                      <span>评分</span>
                      <span>回复</span>
                      <span>提示</span>
                    </div>
                    {runState.collectedCommentRows.map((row) => (
                      <div className="preview-table__row" key={`${row.rowIndex}-${row.externalCommentId}`}>
                        <span>{row.externalCommentId}</span>
                        <span>{row.externalProductId ?? "缺失"}</span>
                        <span>{row.rating ?? "空"}</span>
                        <span>{row.replyStatus ?? "空"}</span>
                        <span>{row.warnings.length ? row.warnings.join("；") : "无"}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </>
            )}

            <CollapsibleSection title="商品 ingest payload" meta={`${productPayload.rows.length} 条待提交`}>
              <pre className="payload-preview">{JSON.stringify(productPayload, null, 2)}</pre>
            </CollapsibleSection>
            <CollapsibleSection title="评论 ingest payload" meta={`${commentPayload.rows.length} 条待提交`}>
              <pre className="payload-preview">{JSON.stringify(commentPayload, null, 2)}</pre>
            </CollapsibleSection>
          </section>

          <ModuleCard title="提交通路" right={<span className="muted-text">contract-first</span>}>
            <div className="submit-panel">
              <p className="muted-text">生产默认路径：商品采集提交到真实 {defaultRealIngestEndpoint}；评论 payload 当前只做预览和后续扩展输入。mock submit 仅保留为开发与断网 fallback。</p>
              <div className="dependency-note">{realIngestAdapterDependency.note}</div>
              {runState.lastError ? <div className="inline-warning">失败原因：{runState.lastError}</div> : null}
              {runState.submitReceipt ? (
                <div className="submit-receipt">
                  <strong>{runState.submitReceipt.submitId}</strong>
                  <span>{runState.submitReceipt.message}</span>
                  <span>接收记录：{runState.submitReceipt.acceptedRows}</span>
                  <span>通路：{runState.submitReceipt.adapter === "real-api" ? "真实 /api/ingest" : "mock fallback"}</span>
                </div>
              ) : null}
              <a className="console-link" href="http://localhost:3010/sku-health" target="_blank" rel="noreferrer">
                打开员工工作台 SKU 健康页
              </a>
            </div>
          </ModuleCard>
        </div>

        <footer className="sticky-action-bar">
          <div className="sticky-action-bar__grid">
            <button className="secondary-button" type="button" onClick={() => setActiveProductPageIndex((value) => (value + 1) % syntheticDoudianPages.length)}>
              切换商品页
            </button>
            <button className="secondary-button" type="button" onClick={() => setActiveCommentPageIndex((value) => (value + 1) % (syntheticDoudianCommentPages.length + 1))}>
              切换评论页
            </button>
            <button className="warn-button" type="button" onClick={() => setRunState(resetTaskState(Math.max(syntheticDoudianPages.length, syntheticDoudianCommentPages.length)))}>
              复位 run
            </button>
            <button className="secondary-button" type="button" onClick={() => setRunState(attachTaskSubmitReceipt(runState, mockCombinedReceipt(runState)))}>
              mock submit
            </button>
            <button className="primary-button sticky-action-bar__full" type="button" onClick={() => void submitRealPayloads()}>
              提交商品与评论 ingest
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
