/**
 * ServerList — renders the list of configured databases.
 *
 * Matches the FileMaker portal behavior:
 *   - Shows up to MAX_ROWS rows; shows a "+ N more" footer if there are extras
 *   - Sorted ascending by displayName
 *   - Loading, error, and empty states
 *   - Connection status dot and last-refreshed timestamp in the footer
 */

import ServerRow from './ServerRow'
import StatusDot from './StatusDot'

const MAX_ROWS = 5

function formatTime(date) {
  if (!date) return null
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ServerList({ databases, loading, refreshing, error, lastFetched, onRetry }) {
  const footer = (
    <div className="server-list__footer">
      <StatusDot loading={loading} refreshing={refreshing} error={!!error} />
      {lastFetched && !loading && (
        <span className="server-list__timestamp">Updated {formatTime(lastFetched)}</span>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="server-list">
        <div className="server-list__rows">
          {Array.from({ length: MAX_ROWS }).map((_, i) => (
            <div key={i} className="server-row server-row--skeleton">
              <div className="skeleton skeleton--icon" />
              <div className="server-row__main">
                <div className="skeleton skeleton--name" />
                <div className="skeleton skeleton--comments" />
              </div>
              <div className="server-row__meta">
                <div className="skeleton skeleton--badge" />
              </div>
            </div>
          ))}
        </div>
        {footer}
      </div>
    )
  }

  if (error) {
    return (
      <div className="server-list">
        <div className="server-list__rows server-list--error">
          <span className="server-list__error-icon" aria-hidden="true">⚠</span>
          <span className="server-list__error-text">{error}</span>
          {onRetry && (
            <button className="server-list__retry-btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
        {footer}
      </div>
    )
  }

  if (!databases || databases.length === 0) {
    return (
      <div className="server-list">
        <div className="server-list__rows server-list--empty">
          <span className="server-list__empty-text">No databases configured.</span>
        </div>
        {footer}
      </div>
    )
  }

  const sorted = [...databases].sort((a, b) =>
    (a.displayName ?? '').localeCompare(b.displayName ?? '')
  )
  const visible = sorted.slice(0, MAX_ROWS)
  const overflow = sorted.length - visible.length

  return (
    <div className="server-list">
      <div className="server-list__rows">
        {visible.map((db, index) => (
          <ServerRow
            key={db.databaseID ?? index}
            database={db}
            rowIndex={index}
          />
        ))}
        {overflow > 0 && (
          <div className="server-row server-row--overflow" aria-label={`${overflow} more database${overflow !== 1 ? 's' : ''} not shown`}>
            <span className="server-row__overflow-text">
              +{overflow} more database{overflow !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      {footer}
    </div>
  )
}
