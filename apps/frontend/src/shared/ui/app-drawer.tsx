import type { PropsWithChildren } from 'react'

interface AppDrawerProps extends PropsWithChildren {
  title: string
  description: string
}

export function AppDrawer({ title, description, children }: AppDrawerProps) {
  return (
    <aside className="drawerShell" aria-label={title}>
      <div className="drawerHeader">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button className="iconButton" type="button" disabled>
          ×
        </button>
      </div>
      <div className="drawerBody">{children}</div>
    </aside>
  )
}
