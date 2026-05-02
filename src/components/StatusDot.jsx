/**
 * StatusDot — small connection status indicator.
 *
 * green  = data loaded and live
 * yellow = loading or refreshing
 * red    = error / offline
 */
export default function StatusDot({ loading, refreshing, error }) {
  let state = 'live'
  if (error) state = 'error'
  else if (loading || refreshing) state = 'loading'

  return (
    <span
      className={`status-dot status-dot--${state}`}
      aria-label={state === 'live' ? 'Connected' : state === 'loading' ? 'Loading' : 'Error'}
      title={state === 'live' ? 'Connected' : state === 'loading' ? 'Refreshing…' : 'Connection error'}
    />
  )
}
