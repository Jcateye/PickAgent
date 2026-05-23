interface UnavailableStatePanelProps {
  title: string
  description: string
}

export function UnavailableStatePanel({ title, description }: UnavailableStatePanelProps) {
  return (
    <div className="statePanel statePanel--unavailable">
      <div className="stateIcon">⋯</div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  )
}
