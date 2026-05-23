import type { StatusTone } from "../types/plugin-ui"

import type { ReactNode } from "react"

interface StatusBadgeProps {
  readonly tone: StatusTone
  readonly children: ReactNode
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
