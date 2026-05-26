'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Braces, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Edit2, Plus, Search, Trash2, User } from 'lucide-react'
import type { RuleSetDetailDto, RuleSetListItemDto, RuleSetStatusDto, RuleSetVersionDto } from '../../../../contracts/types/businessFoundation'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './rule-library.module.css'

type RuleFormState =
  | { mode: 'create'; name: string; sourceText: string; status: RuleSetStatusDto }
  | { mode: 'edit'; ruleSetId: string; name: string; sourceText: string; status: RuleSetStatusDto }
type RulePanelTab = 'summary' | 'json' | 'versions'
interface ActionLink {
  href: string
  label: string
}

export function RuleLibraryPage() {
  const [rulePage, setRulePage] = useState<PageDto<RuleSetListItemDto> | null>(null)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(() => getInitialRuleSetId())
  const [selectedRule, setSelectedRule] = useState<RuleSetDetailDto | null>(null)
  const [versions, setVersions] = useState<RuleSetVersionDto[]>([])
  const [query, setQuery] = useState(() => getInitialRuleLibraryParam('q') ?? '')
  const [page, setPage] = useState(() => getInitialRuleLibraryPage())
  const [statusFilter, setStatusFilter] = useState<'ALL' | RuleSetStatusDto>(() => getInitialRuleStatus())
  const [panelTab, setPanelTab] = useState<RulePanelTab>(() => getInitialRulePanelTab())
  const [ruleForm, setRuleForm] = useState<RuleFormState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<ActionLink | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function loadRules(preferredId?: string | null, nextPage = page) {
    const loadedPage = await fetchActivityApi<PageDto<RuleSetListItemDto>>(`/api/rule-sets?page=${nextPage}&pageSize=20`)
    setRulePage(loadedPage)
    const nextId = preferredId ?? selectedRuleId ?? loadedPage.items[0]?.ruleSetId ?? null
    setSelectedRuleId(nextId)
    if (nextId) {
      await loadRuleDetail(nextId)
    } else {
      setSelectedRule(null)
      setVersions([])
      syncRuleLibraryUrl({ ruleSetId: null, panelTab, query, page: nextPage, statusFilter })
    }
  }

  async function loadRuleDetail(ruleSetId: string) {
    const [detail, versionList] = await Promise.all([
      fetchActivityApi<RuleSetDetailDto>(`/api/rule-sets/${ruleSetId}`),
      fetchActivityApi<RuleSetVersionDto[]>(`/api/rule-sets/${ruleSetId}/versions`),
    ])
    setSelectedRule(detail)
    setVersions(versionList)
    syncRuleLibraryUrl({ ruleSetId, panelTab, query, page, statusFilter })
  }

  useEffect(() => {
    syncRuleLibraryUrl({ ruleSetId: selectedRuleId, panelTab, query, page, statusFilter })
    loadRules(null, page).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '规则集 API 加载失败'))
  }, [page, query, statusFilter])

  useEffect(() => {
    if (!selectedRuleId) return
    loadRuleDetail(selectedRuleId)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '规则详情加载失败'))
  }, [selectedRuleId])

  const visibleRules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (rulePage?.items ?? []).filter((rule) => {
      const matchesQuery = !normalizedQuery || rule.name.toLowerCase().includes(normalizedQuery) || rule.ruleSetId.toLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'ALL' || rule.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, rulePage, statusFilter])
  const ruleCount = rulePage?.total ?? 0
  const enabledCount = rulePage?.items.filter((item) => item.status === 'ENABLED').length ?? 0
  const draftCount = rulePage?.items.filter((item) => item.status === 'DRAFT').length ?? 0
  const disabledCount = rulePage?.items.filter((item) => item.status === 'DISABLED').length ?? 0
  const totalPages = Math.max(1, Math.ceil((rulePage?.total ?? 0) / (rulePage?.pageSize ?? 20)))
  const dslText = JSON.stringify({
    rule_set: selectedRule?.ruleSetId,
    metadata: selectedRule ? { name: selectedRule.name, version: selectedRule.version, status: selectedRule.status, source: selectedRule.source } : {},
    summary: selectedRule?.summary,
    rules: selectedRule?.dslJson ?? [],
  }, null, 2)
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/rule-library',
    pageTitle: '规则库',
    selectedEntity: {
      entityType: 'ruleSet',
      entityId: selectedRule?.ruleSetId ?? selectedRuleId ?? 'rule-library',
      label: selectedRule?.name ?? visibleRules.find((item) => item.ruleSetId === selectedRuleId)?.name ?? '规则库',
    },
    visibleFilters: { query, page, statusFilter, panelTab, ruleFormMode: ruleForm?.mode ?? null },
    visibleColumns: ['ruleSetId', 'name', 'status', 'source', 'activeRunCount', 'version'],
  }), [page, panelTab, query, ruleForm?.mode, selectedRule?.name, selectedRule?.ruleSetId, selectedRuleId, statusFilter, visibleRules])

  async function createRuleSet() {
    setRuleForm({
      mode: 'create',
      name: '新的活动规则集',
      sourceText: '由规则库页面创建，等待补充平台规则原文。',
      status: 'DRAFT',
    })
  }

  async function submitRuleForm() {
    if (!ruleForm) return
    const name = ruleForm.name.trim()
    const sourceText = ruleForm.sourceText.trim()
    if (!name || !sourceText) {
      setMessage('规则集名称和规则原文不能为空')
      return
    }
    setBusy(ruleForm.mode === 'create' ? 'create' : 'edit')
    setActionLink(null)
    try {
      if (ruleForm.mode === 'create') {
        const created = await fetchActivityApi<RuleSetDetailDto>('/api/rule-sets', {
          method: 'POST',
          body: JSON.stringify({
            name,
            sourceText,
            type: 'ACTIVITY_RULE',
            source: 'INTERNAL',
            status: ruleForm.status,
          }),
        })
        setRuleForm(null)
        setMessage(`已创建规则集：${created.name}`)
        setActionLink(ruleRunActionLink(created.workflowRunId, '查看创建 Run', created.ruleSetId))
        await loadRules(created.ruleSetId)
        return
      }
      const updated = await fetchActivityApi<RuleSetDetailDto>(`/api/rule-sets/${ruleForm.ruleSetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          sourceText,
          rules: selectedRule?.ruleSetId === ruleForm.ruleSetId ? selectedRule.dslJson : undefined,
          status: ruleForm.status,
        }),
      })
      setRuleForm(null)
      setSelectedRule(updated)
      setMessage(`已更新规则集：${updated.name}`)
      setActionLink(ruleRunActionLink(updated.workflowRunId, '查看保存 Run', updated.ruleSetId))
      await loadRules(updated.ruleSetId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存规则集失败')
    } finally {
      setBusy(null)
    }
  }

  async function createVersion() {
    if (!selectedRule) return
    setBusy('version')
    setActionLink(null)
    try {
      const version = await fetchActivityApi<RuleSetVersionDto>(`/api/rule-sets/${selectedRule.ruleSetId}/versions`, { method: 'POST', body: JSON.stringify({}) })
      setMessage(`已创建新版本：${version.version}`)
      setActionLink(ruleRunActionLink(version.workflowRunId, '查看版本 Run', version.ruleSetId))
      setPanelTab('versions')
      await loadRules(selectedRule.ruleSetId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建新版本失败')
    } finally {
      setBusy(null)
    }
  }

  async function toggleStatus() {
    if (!selectedRule) return
    const action = selectedRule.status === 'DISABLED' ? 'enable' : 'disable'
    setBusy(action)
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<RuleSetDetailDto>(
        selectedRule.status === 'DISABLED' ? `/api/rule-sets/${selectedRule.ruleSetId}/enable` : `/api/rule-sets/${selectedRule.ruleSetId}`,
        { method: selectedRule.status === 'DISABLED' ? 'POST' : 'DELETE', body: selectedRule.status === 'DISABLED' ? JSON.stringify({}) : undefined },
      )
      setSelectedRule(updated)
      setMessage(`${updated.name} 已${updated.status === 'DISABLED' ? '禁用' : '启用'}`)
      setActionLink(ruleRunActionLink(updated.workflowRunId, '查看状态 Run', updated.ruleSetId))
      await loadRules(updated.ruleSetId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '状态更新失败')
    } finally {
      setBusy(null)
    }
  }

  async function editRuleSet() {
    if (!selectedRule) return
    setRuleForm({
      mode: 'edit',
      ruleSetId: selectedRule.ruleSetId,
      name: selectedRule.name,
      sourceText: selectedRule.sourceText,
      status: selectedRule.status,
    })
  }

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className={styles.layout}>
      <div className={styles.leftSidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.searchRow}>
            <div className={styles.searchInput}>
              <Search size={14} color="var(--muted)" />
              <input type="text" placeholder="搜索规则集名称..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
            </div>
            <button className={styles.btnAdd} type="button" aria-label="创建规则集" onClick={() => void createRuleSet()} disabled={!!busy}><Plus size={16} /></button>
          </div>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${statusFilter === 'ALL' ? styles.active : ''}`} type="button" onClick={() => { setStatusFilter('ALL'); setPage(1) }}>所有 ({ruleCount})</button>
            <button className={`${styles.tab} ${statusFilter === 'ENABLED' ? styles.active : ''}`} type="button" onClick={() => { setStatusFilter('ENABLED'); setPage(1) }}>已启用 ({enabledCount})</button>
            <button className={`${styles.tab} ${statusFilter === 'DRAFT' ? styles.active : ''}`} type="button" onClick={() => { setStatusFilter('DRAFT'); setPage(1) }}>草稿 ({draftCount})</button>
            <button className={`${styles.tab} ${statusFilter === 'DISABLED' ? styles.active : ''}`} type="button" onClick={() => { setStatusFilter('DISABLED'); setPage(1) }}>已禁用 ({disabledCount})</button>
          </div>
        </div>

        <div className={styles.ruleList}>
          {visibleRules.map((rule) => (
            <button className={`${styles.ruleCard} ${rule.ruleSetId === selectedRuleId ? styles.active : ''}`} key={rule.ruleSetId} type="button" onClick={() => { setSelectedRuleId(rule.ruleSetId); syncRuleLibraryUrl({ ruleSetId: rule.ruleSetId, panelTab, query, page, statusFilter }) }}>
              <div className={styles.ruleTitleRow}>
                <div className={styles.ruleTitle}>{rule.name}</div>
                <span className={`${styles.statusBadge} ${rule.status === 'DRAFT' ? styles.statusDraft : styles.statusActive}`}>{rule.status === 'DRAFT' ? '草稿' : rule.status === 'DISABLED' ? '已禁用' : '已启用'}</span>
              </div>
              <div className={styles.ruleMetaRow}>来源: {rule.source} | 运行中 {rule.activeRunCount} 个</div>
              <div className={styles.ruleAuthorRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> by {rule.updatedBy}</div>
                <span className={styles.versionBadge}>{rule.version}</span>
              </div>
            </button>
          ))}
        </div>

        <div className={styles.pagination}>
          <span>{rulePage?.page ?? page} / {totalPages} 页</span>
          <div className={styles.pageControls}>
            <button className={styles.pageBtn} type="button" disabled={page <= 1 || !!busy} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={14} /></button>
            <button className={styles.pageBtn} type="button" disabled={page >= totalPages || !!busy} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      <div className={styles.mainPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.headerTitleRow}>
            <div className={styles.mainTitle}>{selectedRule?.name ?? '请选择规则集'}</div>
            <div className={styles.headerActions}>
              <button className="secondaryButton" type="button" onClick={() => void editRuleSet()} disabled={!selectedRule || !!busy}><Edit2 size={14} /> 编辑</button>
              <button className="secondaryButton" type="button" onClick={() => void createVersion()} disabled={!selectedRule || !!busy}><Copy size={14} /> 创建新版本</button>
              <button className="secondaryButton" type="button" onClick={() => void toggleStatus()} disabled={!selectedRule || !!busy} style={{ color: '#dc2626', borderColor: '#fca5a5' }}><Trash2 size={14} /> {selectedRule?.status === 'DISABLED' ? '启用' : '禁用'}</button>
            </div>
          </div>
          <div className={styles.headerMetaRow}>
            <div className={styles.metaItem}><span style={{ color: 'var(--primary)', background: 'rgba(36, 107, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>版本 {selectedRule?.version ?? '-'} ({selectedRule?.status ?? '-'})</span></div>
            <div className={styles.metaItem}><Clock size={14} /> 规则数 {selectedRule?.summary.ruleCount ?? 0} · {selectedRule?.summary.scopeText ?? '无范围'}</div>
            <div className={styles.metaItem}><User size={14} /> 最后更新 {selectedRule?.updatedAt ? new Date(selectedRule.updatedAt).toLocaleString('zh-CN') : '-'} by {selectedRule?.updatedBy ?? '-'}</div>
          </div>
          {message ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '10px' }}>
              {message}
              {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
            </div>
          ) : null}
          {ruleForm ? (
            <form className={styles.ruleForm} onSubmit={(event) => { event.preventDefault(); void submitRuleForm() }}>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  <span>规则集名称</span>
                  <input value={ruleForm.name} onChange={(event) => setRuleForm((current) => current ? { ...current, name: event.target.value } : current)} />
                </label>
                <label className={styles.formField}>
                  <span>状态</span>
                  <select value={ruleForm.status} onChange={(event) => setRuleForm((current) => current ? { ...current, status: event.target.value as RuleSetStatusDto } : current)}>
                    <option value="DRAFT">草稿</option>
                    <option value="ENABLED">启用</option>
                    <option value="DISABLED">禁用</option>
                  </select>
                </label>
              </div>
              <label className={styles.formField}>
                <span>规则原文</span>
                <textarea value={ruleForm.sourceText} onChange={(event) => setRuleForm((current) => current ? { ...current, sourceText: event.target.value } : current)} rows={4} />
              </label>
              <div className={styles.formActions}>
                <button className="secondaryButton" type="button" onClick={() => setRuleForm(null)} disabled={!!busy}>取消</button>
                <button className="primaryButton" type="submit" disabled={!!busy}>{ruleForm.mode === 'create' ? '创建规则集' : '保存规则集'}</button>
              </div>
            </form>
          ) : null}
        </div>

        <div className={styles.panelTabs}>
          <button className={`${styles.panelTab} ${panelTab === 'summary' ? styles.active : ''}`} type="button" onClick={() => { setPanelTab('summary'); syncRuleLibraryUrl({ ruleSetId: selectedRule?.ruleSetId ?? selectedRuleId, panelTab: 'summary', query, page, statusFilter }) }}>规则概况</button>
          <button className={`${styles.panelTab} ${panelTab === 'json' ? styles.active : ''}`} type="button" onClick={() => { setPanelTab('json'); syncRuleLibraryUrl({ ruleSetId: selectedRule?.ruleSetId ?? selectedRuleId, panelTab: 'json', query, page, statusFilter }) }}>JSON 定义</button>
          <button className={`${styles.panelTab} ${panelTab === 'versions' ? styles.active : ''}`} type="button" onClick={() => { setPanelTab('versions'); syncRuleLibraryUrl({ ruleSetId: selectedRule?.ruleSetId ?? selectedRuleId, panelTab: 'versions', query, page, statusFilter }) }}>版本历史 ({versions.length})</button>
        </div>

        {panelTab === 'summary' ? <RuleSummaryPanel selectedRule={selectedRule} /> : null}
        {panelTab === 'json' ? <RuleJsonPanel dslText={dslText} selectedRule={selectedRule} /> : null}
        {panelTab === 'versions' ? <RuleVersionsPanel versions={versions} selectedRule={selectedRule} /> : null}
      </div>
    </div>
    </>
  )
}

function RuleSummaryPanel({ selectedRule }: { selectedRule: RuleSetDetailDto | null }) {
  if (!selectedRule) return <div className={styles.summaryPanel}><div className={styles.emptyState}>请选择规则集。</div></div>
  return (
    <div className={styles.summaryPanel}>
      <div className={styles.summaryGrid}>
        <SummaryCard label="规则数" value={selectedRule.summary.ruleCount} />
        <SummaryCard label="校验模式" value={selectedRule.summary.validationMode} />
        <SummaryCard label="失败处理" value={selectedRule.summary.failureHandling} />
        <SummaryCard label="优先级" value={selectedRule.summary.priority} />
      </div>

      <section className={styles.summarySection}>
        <div className={styles.summaryTitle}>作用范围</div>
        <div className={styles.summaryText}>{selectedRule.summary.scopeText}</div>
      </section>

      <section className={styles.summarySection}>
        <div className={styles.summaryTitle}>影响字段</div>
        <div className={styles.detailList}>
          {selectedRule.affectedFields.length ? selectedRule.affectedFields.map((field) => (
            <div className={styles.detailCard} key={field.field}>
              <div className={styles.detailCardTitle}>{field.label} <span className={styles.detailMeta}>{field.field}</span></div>
              <div className={styles.summaryText}>{field.required ? '必填字段' : '可选字段'} · 数据源 {field.dataSources.map((source) => source.label).join(' / ') || '-'}</div>
            </div>
          )) : <div className={styles.emptyState}>当前规则集没有返回影响字段。</div>}
        </div>
      </section>

      <section className={styles.summarySection}>
        <div className={styles.summaryTitle}>人工复核项</div>
        <div className={styles.detailList}>
          {selectedRule.manualReviewItems.length ? selectedRule.manualReviewItems.map((item) => (
            <div className={styles.detailCard} key={item.reasonCode}>
              <div className={styles.detailCardTitle}>{item.reasonCode}</div>
              <div className={styles.summaryText}>{item.question}{typeof item.confidence === 'number' ? ` · 置信度 ${item.confidence}` : ''}</div>
            </div>
          )) : <div className={styles.emptyState}>当前规则集没有人工复核项。</div>}
        </div>
      </section>

      <section className={styles.summarySection}>
        <div className={styles.summaryTitle}>关联运行</div>
        <div className={styles.detailList}>
          {selectedRule.relatedRuns.length ? selectedRule.relatedRuns.map((run) => (
            <div className={styles.detailCard} key={run.entityId}>
              <div className={styles.detailCardTitle}>{run.label}</div>
              <div className={styles.detailMeta}>{run.entityType} / {run.entityId}</div>
            </div>
          )) : <div className={styles.emptyState}>当前规则集没有关联运行。</div>}
        </div>
      </section>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>{label}</div><div className={styles.summaryCardValue}>{value}</div></div>
}

function RuleVersionsPanel({ versions, selectedRule }: { versions: RuleSetVersionDto[]; selectedRule: RuleSetDetailDto | null }) {
  if (!selectedRule) return <div className={styles.summaryPanel}><div className={styles.emptyState}>请选择规则集。</div></div>
  return (
    <div className={styles.summaryPanel}>
      <section className={styles.summarySection}>
        <div className={styles.summaryTitle}>版本历史</div>
        <div className={styles.versionTimeline}>
          {versions.length ? versions.map((version) => (
            <div className={`${styles.versionItem} ${version.version === selectedRule.version ? styles.currentVersion : ''}`} key={version.ruleSetVersionId}>
              <div className={styles.versionItemHead}>
                <div>
                  <div className={styles.detailCardTitle}>{version.version}{version.version === selectedRule.version ? ' · 当前版本' : ''}</div>
                  <div className={styles.detailMeta}>{new Date(version.createdAt).toLocaleString('zh-CN')} · {version.createdBy}</div>
                </div>
                <span className={`${styles.statusBadge} ${version.status === 'DRAFT' ? styles.statusDraft : styles.statusActive}`}>{version.status === 'DRAFT' ? '草稿' : version.status === 'DISABLED' ? '已禁用' : '已启用'}</span>
              </div>
              <div className={styles.summaryText}>规则 {version.dslJson.length} 条 · 影响字段 {version.affectedFields.length} 个 · 人工复核 {version.manualReviewItems.length} 项</div>
              {version.workflowRunId ? <a href={runConsoleHref(version.workflowRunId)} style={{ color: 'var(--primary)', fontSize: '13px' }}>查看版本 Run</a> : null}
              <pre className={styles.versionSource}>{version.sourceText}</pre>
            </div>
          )) : <div className={styles.emptyState}>当前规则集还没有版本记录。</div>}
        </div>
      </section>
    </div>
  )
}

function RuleJsonPanel({ dslText, selectedRule }: { dslText: string; selectedRule: RuleSetDetailDto | null }) {
  return (
    <div className={styles.editorContainer}>
      <div className={styles.codeArea}>
        {dslText.split('\n').map((line, index) => (
          <div className={styles.codeLine} key={`${index}:${line}`}>
            <span className={styles.lineNumber}>{index + 1}</span>
            <span className={styles.codeContent}>{line}</span>
          </div>
        ))}
      </div>

      <div className={styles.outlineSidebar}>
        <div className={styles.outlineHeader}>结构大纲</div>
        <div className={styles.outlineBody}>
          <div className={styles.outlineNode}><Braces size={14} color="#ce9178" /> rule_set</div>
          <div className={styles.outlineNode}><Braces size={14} color="#ce9178" /> metadata</div>
          <div className={styles.outlineNode}><ChevronDown size={14} color="var(--muted)" /><Braces size={14} color="#ce9178" /> rules <span style={{ color: 'var(--muted)' }}>[{selectedRule?.dslJson.length ?? 0}]</span></div>
          <div className={styles.outlineIndent}>
            {(selectedRule?.dslJson ?? []).slice(0, 8).map((rule) => (
              <div className={styles.outlineNode} key={rule.id}><Braces size={14} color="#ce9178" /> {rule.id} ({rule.message})</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getInitialRuleSetId(): string | null {
  return getInitialRuleLibraryParam('ruleSetId')
}

function ruleRunActionLink(workflowRunId: string | undefined, label: string, ruleSetId: string): ActionLink {
  return workflowRunId
    ? { href: runConsoleHref(workflowRunId), label }
    : { href: ruleLibraryHref(ruleSetId), label: '查看规则集' }
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function ruleLibraryHref(ruleSetId: string): string {
  const params = new URLSearchParams({ ruleSetId })
  return `/rule-library?${params.toString()}`
}

function getInitialRuleLibraryParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function getInitialRulePanelTab(): RulePanelTab {
  const value = getInitialRuleLibraryParam('panelTab')
  return value === 'summary' || value === 'versions' ? value : 'json'
}

function getInitialRuleLibraryPage(): number {
  const value = Number(getInitialRuleLibraryParam('page') ?? 1)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}

function getInitialRuleStatus(): 'ALL' | RuleSetStatusDto {
  const value = getInitialRuleLibraryParam('status')
  return value === 'ENABLED' || value === 'DRAFT' || value === 'DISABLED' ? value : 'ALL'
}

function syncRuleLibraryUrl(state: {
  ruleSetId: string | null
  panelTab: RulePanelTab
  query: string
  page: number
  statusFilter: 'ALL' | RuleSetStatusDto
}) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (state.ruleSetId) params.set('ruleSetId', state.ruleSetId)
  if (state.panelTab !== 'json') params.set('panelTab', state.panelTab)
  if (state.query.trim()) params.set('q', state.query.trim())
  if (state.page > 1) params.set('page', String(state.page))
  if (state.statusFilter !== 'ALL') params.set('status', state.statusFilter)
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}
