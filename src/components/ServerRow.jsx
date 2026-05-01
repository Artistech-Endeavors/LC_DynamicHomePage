/**
 * ServerRow — a single database entry in the server list.
 *
 * Mirrors the FileMaker portal row layout:
 *   [Icon] [DisplayName / Comments]  [Status badge] [Version] [General status]
 *
 * Clicking the row triggers FileMaker script "Button: Launch DB {databaseID,...}"
 */

import StatusBadge from './StatusBadge'
import { launchDatabase } from '../utils/fileMakerBridge'

export default function ServerRow({ database }) {
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
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() } : undefined}
      aria-label={`Launch ${displayName}`}
    >
      <div className="server-row__icon">
        <span className="server-row__icon-placeholder" aria-hidden="true">⊞</span>
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
    </div>
  )
}
