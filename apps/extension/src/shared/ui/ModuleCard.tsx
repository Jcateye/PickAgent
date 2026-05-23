import type { PropsWithChildren, ReactNode } from "react"

interface ModuleCardProps extends PropsWithChildren {
  readonly title: string
  readonly right?: ReactNode
}

export function ModuleCard({ title, right, children }: ModuleCardProps) {
  return (
    <section className="module-card">
      <header className="module-card__head">
        <div className="module-card__title">{title}</div>
        {right ?? null}
      </header>
      <div className="module-card__body">{children}</div>
    </section>
  )
}
