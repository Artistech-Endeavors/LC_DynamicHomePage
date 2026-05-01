/**
 * ServerList — renders the list of configured databases.
 *
 * Matches the FileMaker portal behavior:
 *   - Shows up to 5 rows
 *   - Sorted ascending by displayName
 *   - Loading, error, and empty states
 */

import ServerRow from './ServerRow'

const MAX_ROWS = 5

export default function ServerList({ databases, loading, error }) {
  if (loading) {
    return (
      <div className="server-list">
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
    )
  }

  if (error) {
    return (
      <div className="server-list server-list--error">
        <span className="server-list__error-icon">⚠</span>
        <span className="server-list__error-text">{error}</span>
      </div>
    )
  }

  if (!databases || databases.length === 0) {
    return (
      <div className="server-list server-list--empty">
        <span className="server-list__empty-text">No databases configured.</span>
      </div>
    )
  }

  const sorted = [...databases]
    .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
    .slice(0, MAX_ROWS)

  return (
    <div className="server-list">
      {sorted.map((db, index) => (
        <ServerRow
          key={db.databaseID ?? index}
          database={db}
        />
      ))}
    </div>
  )
}
