import type { ApiViewState } from '@/modules/staff-health-console/contracts'
import { StatusBadge } from '@/shared/ui/status-badge'

export function ApiStatePanel({ state }: { state: ApiViewState }) {
  const tone = state.kind === 'real' ? 'ready' : state.kind === 'empty' ? 'review' : 'blocked'
  const label = state.kind === 'real' ? 'REAL API' : state.kind === 'empty' ? 'EMPTY API' : 'FALLBACK'

  return (
    <div className={`apiStatePanel apiStatePanel--${state.kind}`}>
      <StatusBadge tone={tone}>{label}</StatusBadge>
      <div>
        <strong>{state.endpoint}</strong>
        <p>{state.message}</p>
        {state.requestId ? <small>requestId: {state.requestId}</small> : null}
      </div>
    </div>
  )
}
