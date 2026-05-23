'use client'

import { usePathname } from 'next/navigation'

import { appPages } from '@/shared/config/app-pages'

export function Topbar() {
  const pathname = usePathname()
  const currentPage = appPages.find((page) => page.href === pathname)

  return (
    <header className="topbar">
      <div className="topbarSearchArea">
        <div className="searchBox">
          <span>⌕</span>
          <input value="搜索 SKU / 商品 / 活动 / Mission" readOnly aria-label="搜索占位输入框" />
        </div>
        <div className="topbarFilters">
          <span className="filterPill">Platform</span>
          <span className="filterPill">Store</span>
          <span className="filterPill">Category</span>
          <span className="filterPill">Latest Run</span>
        </div>
      </div>
      <div className="topbarActions">
        <button className="secondaryButton" type="button" disabled>
          证据链侧栏
        </button>
        <button className="primaryButton" type="button" disabled>
          {currentPage?.title ?? '主控台'}
        </button>
      </div>
    </header>
  )
}
