import type { PropsWithChildren, ReactNode } from 'react'

interface AppModalProps extends PropsWithChildren {
  title: string
  description: string
  footer?: ReactNode
}

export function AppModal({ title, description, footer, children }: AppModalProps) {
  return (
    <div className="overlayShell" role="presentation">
      <div className="overlayCard" role="dialog" aria-modal="false" aria-label={title}>
        <div className="overlayHeader">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button className="iconButton" type="button" disabled>
            ×
          </button>
        </div>
        <div className="overlayBody">{children}</div>
        {footer ? <div className="overlayFooter">{footer}</div> : null}
      </div>
    </div>
  )
}
