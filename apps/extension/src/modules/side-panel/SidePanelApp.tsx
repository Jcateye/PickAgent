import { useMemo, useState } from "react"

import {
  attachMockSubmitReceipt,
  buildIngestPayload,
  collectThroughPage,
  createInitialRunState,
  extractDoudianCurrentPage,
  realIngestAdapterDependency,
  recognizeDoudianProductList,
  scanCurrentPage,
  syntheticDoudianPages,
  unsupportedSyntheticPage
} from "../../lib/ingest"
import type { CollectionRunState, CollectablePageStatus, RunStatus } from "../../schemas/ingest"
import { CollapsibleSection } from "../../shared/ui/CollapsibleSection"
import { ModuleCard } from "../../shared/ui/ModuleCard"
import { SecurityNote } from "../../shared/ui/SecurityNote"
import { StatusBadge } from "../../shared/ui/StatusBadge"

function recognitionTone(status: CollectablePageStatus) {
  if (status === "collectible") {
    return "ready" as const
  }

  if (status === "needs-confirmation") {
    return "review" as const
  }

  return "blocked" as const
}

function runTone(status: RunStatus) {
  if (status === "submitted") {
    return "ready" as const
  }

  if (status === "failed") {
    return "blocked" as const
  }

  if (status === "paused") {
    return "review" as const
  }

  return "repair" as const
}

function runStatusLabel(status: RunStatus) {
  const labels: Record<RunStatus, string> = {
    idle: "未开始",
    scanned: "已扫描",
    collecting: "采集中",
    paused: "已中断",
    submitted: "已提交 mock",
    failed: "不可采集"
  }

  return labels[status]
}

function buildSummary(runState: CollectionRunState) {
  const rows = runState.currentPreview?.rows ?? []
  const warningRows = rows.filter((row) => row.warnings.length > 0).length

  return [
    { label: "当前页记录", value: String(rows.length), tone: "repair" as const },
    { label: "累计记录", value: String(runState.collectedRows.length), tone: "ready" as const },
    { label: "异常字段行", value: String(warningRows), tone: warningRows > 0 ? ("review" as const) : ("ready" as const) },
    { label: "当前页码", value: `${runState.currentPage}/${runState.totalPages}`, tone: "repair" as const }
  ]
}

export function SidePanelApp() {
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [useUnsupportedPage, setUseUnsupportedPage] = useState(false)
  const [runState, setRunState] = useState<CollectionRunState>(() => createInitialRunState(syntheticDoudianPages.length))

  const activePage = useUnsupportedPage ? unsupportedSyntheticPage : syntheticDoudianPages[activePageIndex]
  const recognition = useMemo(() => recognizeDoudianProductList(activePage), [activePage])
  const preview = runState.currentPreview ?? extractDoudianCurrentPage(activePage)
  const payload = buildIngestPayload(runState)
  const summary = buildSummary(runState)
  const progressValue = Math.round((runState.currentPage / runState.totalPages) * 100)

  return (
    <div className="plugin-root sidepanel-root">
      <section className="sidepanel-shell">
        <header className="sidepanel-shell__top">
          <div className="sidepanel-shell__topbar">
            <div className="sidepanel-shell__title-wrap">
              <div className="logo-badge">SR</div>
              <div>
                <h1 className="sidepanel-shell__title">SKU Ready Agent</h1>
                <p className="sidepanel-shell__subtitle">抖店商品列表采集 Layer 1</p>
              </div>
            </div>
            <StatusBadge tone={runTone(runState.status)}>{runStatusLabel(runState.status)}</StatusBadge>
          </div>

          <div className="sidepanel-hero">
            <div className="sidepanel-hero__card">
              <div className="sidepanel-hero__eyebrow">当前页面识别</div>
              <div className="sidepanel-hero__headline">
                {recognition.platform} · {recognition.pageType}
              </div>
              <div className="sidepanel-hero__detail">
                {recognition.status === "unsupported"
                  ? recognition.unsupportedReason
                  : `第 ${recognition.pageIndex} / ${recognition.totalPages} 页，识别置信度 ${Math.round(recognition.confidence * 100)}%。`}
              </div>
            </div>
            <div className="sidepanel-hero__metrics">
              <div className="hero-metric">
                <div className="hero-metric__label">累计记录</div>
                <div className="hero-metric__value">{runState.collectedRows.length}</div>
                <div className="hero-metric__note">仅采集事实，不生成业务结论</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric__label">运行进度</div>
                <div className="hero-metric__value">{progressValue}%</div>
                <div className="hero-metric__note">受控分页循环</div>
              </div>
            </div>
          </div>
        </header>

        <div className="sidepanel-shell__body">
          <ModuleCard title="页面识别结果" right={<StatusBadge tone={recognitionTone(recognition.status)}>{recognition.status === "collectible" ? "可采集页面" : "不可采集"}</StatusBadge>}>
            <div className="recognition-layout">
              <div>
                <h2 className="recognition-layout__title">识别依据摘要</h2>
                <p className="muted-text">插件只读取当前页面可见 DOM 与 synthetic fixture。Layer 3 前必须用真实抖店 fixture 替换。</p>
                <div className="recognition-layout__grid">
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">URL</div>
                    <div className="recognition-layout__fact-value">{activePage.url}</div>
                  </div>
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">命中规则</div>
                    <div className="recognition-layout__fact-value">{recognition.reasons.join(" / ")}</div>
                  </div>
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">本页记录</div>
                    <div className="recognition-layout__fact-value">{activePage.rows.length} 条</div>
                  </div>
                  <div className="recognition-layout__fact">
                    <div className="recognition-layout__fact-label">采集边界</div>
                    <div className="recognition-layout__fact-value">仅当前授权页面可见字段</div>
                  </div>
                </div>
              </div>
              <SecurityNote title="安全边界" text="不读取 Cookie / Token，不自动修改后台数据，不在插件内推导健康、准入或审批结论。" />
            </div>
          </ModuleCard>

          <ModuleCard title="扫描与受控循环" right={<span className="muted-text">当前页：{activePage.pageIndex}</span>}>
            <div className="scan-card">
              <div className="scan-card__cta">
                <div>
                  <h2 className="scan-card__title">当前页提取与字段映射预览</h2>
                  <p className="muted-text">先扫描当前页，再按分页顺序采集。发生结构异常时保留 run state 和继续入口。</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setRunState(scanCurrentPage(runState, activePage))}>
                  扫描当前页
                </button>
              </div>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => setRunState(collectThroughPage(createInitialRunState(syntheticDoudianPages.length), syntheticDoudianPages, 2))}>
                  采集到第 2 页并中断
                </button>
                <button className="secondary-button" type="button" onClick={() => setRunState(collectThroughPage(runState, syntheticDoudianPages.slice(runState.currentPage)))}>
                  继续采集
                </button>
                <button className="secondary-button" type="button" onClick={() => setUseUnsupportedPage((value) => !value)}>
                  切换不可采集样例
                </button>
              </div>
              <div>
                <div className="scan-card__progress-head">
                  <span className="scan-card__progress-label">运行总进度</span>
                  <span className="muted-text">第 {runState.currentPage} / {runState.totalPages} 页 · {runState.collectedRows.length} 条</span>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${progressValue}%` }} />
                </div>
              </div>
              {runState.interruptionReason ? <div className="inline-warning">{runState.interruptionReason}</div> : null}
            </div>
          </ModuleCard>

          <ModuleCard title="本地 run state" right={<StatusBadge tone={runTone(runState.status)}>{runStatusLabel(runState.status)}</StatusBadge>}>
            <div className="timeline-card">
              <div className="timeline-card__head">
                <div>
                  <h2 className="timeline-card__title">当前采集 Run：{runState.runId}</h2>
                  <p className="muted-text">记录当前页、累计记录数、运行状态和中断原因；这些状态仅用于采集流程控制。</p>
                </div>
                <div className="timeline-card__meta">
                  <span className="timeline-chip">当前页 {runState.currentPage}</span>
                  <span className="timeline-chip">累计 {runState.collectedRows.length}</span>
                  <span className="timeline-chip">状态 {runStatusLabel(runState.status)}</span>
                </div>
              </div>
              <div className="timeline-list">
                <article className="timeline-step timeline-step--done">
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">页面识别</div>
                    <div className="timeline-step__time">fixture</div>
                  </div>
                  <p className="muted-text">{recognition.reasons.join("；")}</p>
                </article>
                <article className={`timeline-step timeline-step--${runState.currentPreview ? "done" : "waiting"}`}>
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">当前页提取</div>
                    <div className="timeline-step__time">{preview.rows.length} 条</div>
                  </div>
                  <p className="muted-text">标准字段预览已生成，异常字段会保留在 warnings。</p>
                </article>
                <article className={`timeline-step timeline-step--${runState.status === "paused" ? "active" : "waiting"}`}>
                  <div className="timeline-step__top">
                    <div className="timeline-step__title">受控中断点</div>
                    <div className="timeline-step__time">{runState.status === "paused" ? "可继续" : "无中断"}</div>
                  </div>
                  <p className="muted-text">{runState.interruptionReason ?? "自动循环尚未遇到翻页或结构异常。"}</p>
                </article>
              </div>
            </div>
          </ModuleCard>

          <ModuleCard title="扫描结果摘要" right={<span className="muted-text">采集层指标</span>}>
            <div className="summary-grid">
              {summary.map((metric) => (
                <div className="summary-metric" key={metric.label}>
                  <div className={`summary-metric__value summary-metric__value--${metric.tone}`}>{metric.value}</div>
                  <div className="summary-metric__label">{metric.label}</div>
                </div>
              ))}
            </div>
          </ModuleCard>

          <section className="module-card">
            <CollapsibleSection title="字段映射预览" meta={`${preview.mapping.length} 个标准字段`}>
              <div className="mapping-list">
                {preview.mapping.map((row) => (
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

            <CollapsibleSection title="当前页记录预览" meta={`${preview.rows.length} 条`}>
              <div className="preview-table">
                <div className="preview-table__row preview-table__row--head">
                  <span>SKU</span>
                  <span>标题</span>
                  <span>价格</span>
                  <span>库存</span>
                  <span>提示</span>
                </div>
                {preview.rows.map((row) => (
                  <div className="preview-table__row" key={`${row.rowIndex}-${row.title}`}>
                    <span>{row.externalSkuId || "缺失"}</span>
                    <span>{row.title || "缺失"}</span>
                    <span>{row.salePrice ?? "空"}</span>
                    <span>{row.availableStock ?? "空"}</span>
                    <span>{row.warnings.length ? row.warnings.join("；") : "无"}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="mock submit payload" meta={`${payload.rows.length} 条待提交`}>
              <pre className="payload-preview">{JSON.stringify(payload, null, 2)}</pre>
            </CollapsibleSection>
          </section>

          <ModuleCard title="提交通路" right={<span className="muted-text">contract-first</span>}>
            <div className="submit-panel">
              <p className="muted-text">Layer 1 使用 mock submit adapter 验证 payload 形状。真实接口接入等待依赖完成，不在本 change 内实现后端 ingest service。</p>
              <div className="dependency-note">{realIngestAdapterDependency.note}</div>
              {runState.submitReceipt ? (
                <div className="submit-receipt">
                  <strong>{runState.submitReceipt.submitId}</strong>
                  <span>{runState.submitReceipt.message}</span>
                  <span>接收记录：{runState.submitReceipt.acceptedRows}</span>
                </div>
              ) : null}
            </div>
          </ModuleCard>
        </div>

        <footer className="sticky-action-bar">
          <div className="sticky-action-bar__grid">
            <button className="secondary-button" type="button" onClick={() => setActivePageIndex((value) => (value + 1) % syntheticDoudianPages.length)}>
              切换页 fixture
            </button>
            <button className="warn-button" type="button" onClick={() => setRunState(createInitialRunState(syntheticDoudianPages.length))}>
              重置 run
            </button>
            <button className="secondary-button sticky-action-bar__full" type="button" onClick={() => setRunState(attachMockSubmitReceipt(runState))}>
              mock submit 采集 payload
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
