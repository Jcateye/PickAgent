interface ErrorStatePanelProps {
  title: string
  description: string
}

export function ErrorStatePanel({ title, description }: ErrorStatePanelProps) {
  return (
    <div className="statePanel statePanel--error">
      <div className="stateIcon">!</div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  )
}
