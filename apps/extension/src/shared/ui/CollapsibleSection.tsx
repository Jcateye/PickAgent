import { useState } from "react"
import type { PropsWithChildren } from "react"

interface CollapsibleSectionProps extends PropsWithChildren {
  readonly title: string
  readonly meta: string
  readonly defaultOpen?: boolean
}

export function CollapsibleSection({
  title,
  meta,
  defaultOpen = false,
  children
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="accordion" data-open={open}>
      <button className="accordion__trigger" type="button" onClick={() => setOpen((value) => !value)}>
        <span className="accordion__title">
          <span className="accordion__chevron">›</span>
          <span className="module-card__title">{title}</span>
        </span>
        <span className="accordion__meta">{meta}</span>
      </button>
      {open ? <div className="accordion__panel">{children}</div> : null}
    </section>
  )
}
