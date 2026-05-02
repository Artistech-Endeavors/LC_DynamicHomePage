/**
 * ServerRow — a single database entry in the server list.
 *
 * Mirrors the FileMaker portal row layout:
 *   [Icon] [DisplayName / Comments]  [Status badge] [Version] [General status] [›]
 *
 * Clicking the row triggers FileMaker script "Button: Launch DB {databaseID,...}"
 */

import StatusBadge from './StatusBadge'
import { launchDatabase } from '../utils/fileMakerBridge'

function DatabaseIcon() {
  return (
    <svg
      className="server-row__db-icon"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top ellipse */}
      <ellipse cx="10" cy="5" rx="7" ry="2.5" fill="currentColor" opacity="0.85" />
      {/* Body */}
      <path d="M3 5v10c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      {/* Middle line */}
      <path d="M3 10c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none" />
    </svg>
  )
}

export default function ServerRow({ database, rowIndex = 0 }) {
  const {
    databaseID,
    displayName,
    comments,
    status,
    lastVersion,
    generalStatus,
    isClickable = true,
  } = database

  function handleClick() {
    if (!isClickable || !databaseID) return
    launchDatabase(databaseID)
  }

  return (
    <div
      className={`server-row${isClickable ? ' server-row--clickable' : ''}`}
      style={{ '--row-index': rowIndex }}
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() } : undefined}
      aria-label={isClickable ? `Launch ${displayName}` : displayName}
    >
      <div className="server-row__icon">
        <DatabaseIcon />
      </div>

      <div className="server-row__main">
        <span className="server-row__name">{displayName}</span>
        {comments && <span className="server-row__comments">{comments}</span>}
      </div>

      <div className="server-row__meta">
        <StatusBadge status={status} />
        {lastVersion && (
          <span className="server-row__version">{lastVersion}</span>
        )}
        {generalStatus && (
          <span className="server-row__general-status">{generalStatus}</span>
        )}
      </div>

      <div className="server-row__chevron" aria-hidden="true">›</div>
    </div>
  )
}
