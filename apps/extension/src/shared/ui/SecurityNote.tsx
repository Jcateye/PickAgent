interface SecurityNoteProps {
  readonly title: string
  readonly text: string
}

export function SecurityNote({ title, text }: SecurityNoteProps) {
  return (
    <div className="security-note">
      <div className="security-note__icon">安</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div className="muted-text">{text}</div>
      </div>
    </div>
  )
}
