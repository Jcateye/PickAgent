'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { appPages } from '@/shared/config/app-pages'
import { cn } from '@/shared/lib/cn'

export function SidebarNav() {
  const pathname = usePathname()
  const primaryPages = appPages.filter((page) => page.category === 'primary')
  const secondaryPages = appPages.filter((page) => page.category === 'secondary')

  return (
    <aside className="sidebar">
      <div className="brandBlock">
        <div className="brandLogo">SR</div>
        <div>
          <strong>SKU Ready Agent</strong>
          <p>活动规则执行与商品准入 Agent</p>
        </div>
      </div>

      <div className="workspaceCard">
        <div>
          <b>双入口工作台</b>
          <span>员工使用业务页面操作，Agent Mission 接收目标并编排长任务</span>
        </div>
      </div>

      <nav className="navSection">
        <div className="navLabel">主导航</div>
        {primaryPages.map((page) => {
          const isActive = pathname === page.href
          return (
            <Link key={page.key} href={page.href} className={cn('navItem', isActive && 'navItem--active')}>
              <span className="navLeft">
                <span className="navIcon">{page.icon}</span>
                <span>{page.navLabel}</span>
              </span>
            </Link>
          )
        })}

        <div className="navLabel navLabel--spaced">扩展能力</div>
        {secondaryPages.map((page) => {
          const isActive = pathname === page.href
          return (
            <Link key={page.key} href={page.href} className={cn('navItem', isActive && 'navItem--active')}>
              <span className="navLeft">
                <span className="navIcon">{page.icon}</span>
                <span>{page.navLabel}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="sidebarFooterNote">
        <h4>设计策略</h4>
        <p>业务判断留在服务端，Chat 只展示目标、计划、工具痕迹、证据和人工接管点。</p>
      </div>
    </aside>
  )
}
