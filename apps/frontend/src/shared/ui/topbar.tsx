'use client'

import { Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { appMenus } from '@/shared/config/app-pages'

export function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/sku-access?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <header className="topbar">
      <form className="topbarSearchArea" onSubmit={submitSearch}>
        <div className="searchBox">
          <Search size={16} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 SKU / 商品 / 活动 / Mission"
            aria-label="全局搜索"
          />
        </div>
        <div className="topbarFilters">
          <span className="filterPill">Platform</span>
          <span className="filterPill">Store</span>
          <span className="filterPill">Category</span>
          <span className="filterPill">Latest Run</span>
        </div>
      </form>
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
