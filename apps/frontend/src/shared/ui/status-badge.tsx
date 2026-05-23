import type { ReactNode } from 'react'

interface StatusBadgeProps {
  tone?: 'neutral' | 'ready' | 'review' | 'warning' | 'blocked'
  children: ReactNode
}

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`statusBadge statusBadge--${tone}`}>{children}</span>
}
