interface KeyFactCardProps {
  readonly label: string
  readonly value: string
}

export function KeyFactCard({ label, value }: KeyFactCardProps) {
  return (
    <div className="kv-card">
      <div className="kv-card__label">{label}</div>
      <div className="kv-card__value">{value}</div>
    </div>
  )
}
