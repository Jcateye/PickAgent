import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="pageHeader">
      <div className="pageHeaderText">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="pageHeaderActions">{actions}</div> : null}
    </div>
  )
}
