'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, CalendarCheck, ListTodo, ShieldCheck, BarChart3, Database, BookOpen, Settings, ChevronDown } from 'lucide-react'

import { appMenus } from '@/shared/config/app-pages'
import { cn } from '@/shared/lib/cn'

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home size={18} />,
  FileText: <FileText size={18} />,
  CalendarCheck: <CalendarCheck size={18} />,
  ListTodo: <ListTodo size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  BarChart3: <BarChart3 size={18} />,
  Database: <Database size={18} />,
  BookOpen: <BookOpen size={18} />,
  Settings: <Settings size={18} />,
}

export function SidebarNav() {
  const pathname = usePathname()
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['tasks-runs'])

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  return (
    <aside className="sidebar">
      <div className="brandBlock">
        <div className="brandLogo" style={{ background: '#20C997', color: 'white' }}>SR</div>
        <div>
          <strong style={{ fontSize: '15px' }}>SKU Ready Agent</strong>
        </div>
      </div>

      <nav className="navSection" style={{ marginTop: '16px', flex: 1 }}>
        {appMenus.map((menu) => {
          const isExpanded = expandedKeys.includes(menu.key)
          const hasChildren = menu.children && menu.children.length > 0
          const isActive = pathname === menu.href || (hasChildren && menu.children?.some(c => pathname === c.href))

          return (
            <div key={menu.key} style={{ marginBottom: '2px' }}>
              {hasChildren ? (
                <div 
                  className={cn('navItem', isActive && !isExpanded && 'navItem--active')} 
                  onClick={() => toggleExpand(menu.key)}
                  style={{ cursor: 'pointer', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span className="navLeft" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isActive ? 'white' : 'var(--muted)' }}>
                    <span className="navIcon">{ICON_MAP[menu.icon]}</span>
                    <span style={{ fontSize: '14px', fontWeight: isActive ? 500 : 400 }}>{menu.label}</span>
                  </span>
                  <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--muted)' }} />
                </div>
              ) : (
                <Link href={menu.href!} className={cn('navItem')} style={{ 
                  padding: '8px 12px', 
                  display: 'flex', 
                  alignItems: 'center',
                  background: pathname === menu.href ? 'var(--primary)' : 'transparent',
                  borderRadius: '6px'
                }}>
                  <span className="navLeft" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: pathname === menu.href ? 'white' : 'var(--muted)' }}>
                    <span className="navIcon">{ICON_MAP[menu.icon]}</span>
                    <span style={{ fontSize: '14px', fontWeight: pathname === menu.href ? 500 : 400 }}>{menu.label}</span>
                  </span>
                </Link>
              )}

              {hasChildren && isExpanded && (
                <div style={{ paddingLeft: '34px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {menu.children!.map(child => (
                    <Link 
                      key={child.key} 
                      href={child.href}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        color: pathname === child.href ? 'white' : 'var(--muted)',
                        background: pathname === child.href ? 'rgba(255,255,255,0.1)' : 'transparent',
                        borderRadius: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4A5568', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
            OP
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>运营专员</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>op_team</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
