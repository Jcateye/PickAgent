import type { PropsWithChildren } from 'react'

interface CollapseSectionProps extends PropsWithChildren {
  title: string
  hint?: string
  defaultOpen?: boolean
}

export function CollapseSection({ title, hint, defaultOpen = false, children }: CollapseSectionProps) {
  return (
    <details className="collapseSection" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span>{hint ?? '按需查看'}</span>
      </summary>
      <div className="collapseBody">{children}</div>
    </details>
  )
}
