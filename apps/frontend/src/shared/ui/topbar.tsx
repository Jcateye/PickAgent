'use client'

import { usePathname } from 'next/navigation'

import { appMenus } from '@/shared/config/app-pages'

export function Topbar() {
  const pathname = usePathname()
  
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
          {currentTitle}
        </button>
      </div>
    </header>
  )
}
