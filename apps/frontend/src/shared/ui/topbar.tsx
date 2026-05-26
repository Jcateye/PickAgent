'use client'

import Link from 'next/link'
import { FileSearch, RefreshCw, Search, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useMemo } from 'react'
import { useState } from 'react'

import { fetchActivityApi } from '@/modules/activity/api-client'
import { appMenus } from '@/shared/config/app-pages'

interface HealthSummaryDto {
  total: number
  ready: number
  warning: number
  blocked: number
}

interface RunConsolePageDto {
  items: Array<{
    runId: string
    type: string
    status: string
    subject: string
  }>
  total: number
}

interface TopbarLiveContext {
  health: HealthSummaryDto | null
  latestRun: RunConsolePageDto['items'][number] | null
  error: string | null
}

export function Topbar() {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('tmall')
  const [storeId, setStoreId] = useState('')
  const [category, setCategory] = useState('')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [liveContext, setLiveContext] = useState<TopbarLiveContext>({ health: null, latestRun: null, error: null })
  
  let currentTitle = '主控台'
  for (const menu of appMenus) {
    if (menu.href === pathname) {
      currentTitle = menu.label
      break
    }
    if (menu.children) {
      const child = menu.children.find(c => c.href === pathname)
      if (child) {
        currentTitle = child.label
        break
      }
    }
  }

  useEffect(() => {
    let disposed = false
    async function loadLiveContext() {
      try {
        const [health, runs] = await Promise.all([
          fetchActivityApi<HealthSummaryDto>('/api/health/summary'),
          fetchActivityApi<RunConsolePageDto>('/api/run-console?pageSize=1'),
        ])
        if (!disposed) setLiveContext({ health, latestRun: runs.items[0] ?? null, error: null })
      } catch (error) {
        if (!disposed) setLiveContext({ health: null, latestRun: null, error: error instanceof Error ? error.message : '证据链实时上下文加载失败' })
      }
    }
    void loadLiveContext()
    return () => {
      disposed = true
    }
  }, [pathname])

  const evidenceLinks = useMemo(() => evidenceLinksForPath(pathname, liveContext), [liveContext, pathname])
  const latestRunHref = liveContext.latestRun ? `/run-console?runId=${liveContext.latestRun.runId}` : '/run-console'

  return (
    <header className="topbar">
      <form className="topbarSearchArea" action="/sku-access" method="get">
        <div className="searchBox">
          <button className="topbarSearchSubmit" type="submit" aria-label="执行全局搜索">
            <Search size={16} aria-hidden />
          </button>
          <input
            value={query}
            id="topbar-global-query"
            name="q"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 SKU / 商品 / 活动 / Mission"
            aria-label="全局搜索"
          />
        </div>
        <div className="topbarFilters">
          <label className="filterPill">
            Platform
            <select id="topbar-global-platform" name="platform" value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="全局搜索平台">
              <option value="">全部</option>
              <option value="tmall">天猫</option>
              <option value="douyin">抖店</option>
              <option value="jd">京东</option>
            </select>
          </label>
          <label className="filterPill">
            Store
            <input id="topbar-global-store" name="storeId" value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="全局搜索店铺" />
          </label>
          <label className="filterPill">
            Category
            <input id="topbar-global-category" name="category" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="全局搜索类目" />
          </label>
          <Link className="filterPill filterPillLink" href={latestRunHref}>
            Latest Run{liveContext.latestRun ? ` #${liveContext.latestRun.runId.slice(0, 8)}` : ''}
          </Link>
        </div>
      </form>
      <div className="topbarActions">
        <button className="secondaryButton" type="button" onClick={() => setEvidenceOpen(true)}>
          <FileSearch size={16} aria-hidden />
          证据链侧栏
        </button>
        <button className="primaryButton" type="button" onClick={() => router.refresh()}>
          <RefreshCw size={16} aria-hidden />
          {currentTitle}
        </button>
      </div>
      {evidenceOpen ? (
        <div className="topbarEvidenceOverlay" role="presentation" onClick={() => setEvidenceOpen(false)}>
          <aside className="topbarEvidenceDrawer" aria-label="证据链侧栏" onClick={(event) => event.stopPropagation()}>
            <div className="topbarEvidenceHeader">
              <div>
                <strong>证据链侧栏</strong>
                <p>{currentTitle} · {pathname}</p>
              </div>
              <button className="iconButton" type="button" onClick={() => setEvidenceOpen(false)} aria-label="关闭证据链侧栏">
                <X size={16} />
              </button>
            </div>
            <div className="topbarEvidenceBody">
              {liveContext.error ? <div className="topbarEvidenceStatus">{liveContext.error}</div> : null}
              {evidenceLinks.map((item) => (
                <Link className="topbarEvidenceLink" href={item.href} key={item.href} onClick={() => setEvidenceOpen(false)}>
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  )
}

function evidenceLinksForPath(pathname: string, liveContext: TopbarLiveContext) {
  const common = [
    {
      label: '运行证据',
      title: liveContext.latestRun ? `最近 Run #${liveContext.latestRun.runId.slice(0, 8)}` : '运行日志',
      description: liveContext.latestRun ? `${liveContext.latestRun.status} · ${liveContext.latestRun.type} · ${liveContext.latestRun.subject}` : '查看连接器同步、Agent run 和 workflow audit。',
      href: liveContext.latestRun ? `/run-console?runId=${liveContext.latestRun.runId}` : '/run-console',
    },
    {
      label: '人工证据',
      title: 'Review 工作台',
      description: liveContext.health ? `当前 SKU ${liveContext.health.total} 个，阻塞 ${liveContext.health.blocked} 个，预警 ${liveContext.health.warning} 个。` : '查看待审批项、决策记录和证据引用。',
      href: '/review-approvals',
    },
  ]
  if (pathname.startsWith('/sku-access') || pathname.startsWith('/sku-health')) {
    return [
      { label: 'SKU 事实', title: 'SKU 列表', description: '回到 CurrentSkuProjection 清单和 SKU 详情入口。', href: '/sku-access' },
      { label: '规则关联', title: '规则库', description: '查看可复现的规则集版本和 DSL 定义。', href: '/rule-library' },
      ...common,
    ]
  }
  if (pathname.startsWith('/rule-execution') || pathname.startsWith('/rule-library')) {
    return [
      { label: '规则事实', title: '规则库', description: '查看已保存规则集、版本和启停状态。', href: '/rule-library' },
      { label: '模拟结果', title: '规则执行', description: '重新解析活动规则并生成准入模拟。', href: '/rule-execution' },
      ...common,
    ]
  }
  if (pathname.startsWith('/report-center')) {
    return [
      { label: '报告证据', title: '报告中心', description: '查看报告详情、版本、导出和订阅记录。', href: '/report-center' },
      { label: '源数据', title: 'SKU 列表', description: '查看报告引用的 SKU 健康与准备度数据。', href: '/sku-access' },
      ...common,
    ]
  }
  if (pathname.startsWith('/data-sources')) {
    return [
      { label: '采集来源', title: '数据源', description: '查看连接器配置、权限和最近同步运行。', href: '/data-sources' },
      ...common,
    ]
  }
  if (pathname.startsWith('/agent')) {
    return [
      { label: 'Agent 运行', title: 'Agent Mission', description: '查看任务、工具调用、Review Gate 和事件 replay。', href: '/agent-mission' },
      ...common,
    ]
  }
  return [
    { label: '业务总览', title: '概览', description: '查看 SKU、规则、数据源和 Review 的当前状态。', href: '/overview' },
    { label: 'SKU 事实', title: 'SKU 列表', description: '查看 CurrentSkuProjection 和证据详情。', href: '/sku-access' },
    ...common,
  ]
}
