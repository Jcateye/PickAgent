interface EmptyStatePanelProps {
  title: string
  description: string
  actionLabel?: string
}

export function EmptyStatePanel({ title, description, actionLabel }: EmptyStatePanelProps) {
  return (
    <div className="statePanel statePanel--empty">
      <div className="stateIcon">○</div>
      <h4>{title}</h4>
      <p>{description}</p>
      {actionLabel ? (
        <button className="secondaryButton" type="button" disabled>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
