import type { PropsWithChildren, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

interface PanelProps extends PropsWithChildren {
  className?: string
}

export function Panel({ children, className }: PanelProps) {
  return <section className={cn('panel', className)}>{children}</section>
}

interface PanelHeaderProps extends PropsWithChildren {
  title: string
  description?: string
  actions?: ReactNode
}

export function PanelHeader({ title, description, actions, children }: PanelHeaderProps) {
  return (
    <header className="panelHeader">
      <div className="panelHeading">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
      </div>
      {actions ? <div className="panelActions">{actions}</div> : null}
    </header>
  )
}

export function PanelBody({ children, className }: PanelProps) {
  return <div className={cn('panelBody', className)}>{children}</div>
}
