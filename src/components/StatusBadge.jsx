/**
 * StatusBadge — colored pill badge showing a database/server status.
 *
 * Status values (matching FileMaker Status_ct field):
 *   Ready, Running, Update Available, Stopped, Closed, Offline, Users Blocked, Failed, Loading, Unknown
 */

const STATUS_COLORS = {
  'Ready':           { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
  'Running':         { bg: '#cce5ff', text: '#004085', border: '#b8daff' },
  'Update Available':{ bg: '#fff3cd', text: '#856404', border: '#ffeeba' },
  'Stopped':         { bg: '#ffe5cc', text: '#7a3a00', border: '#ffd0aa' },
  'Closed':          { bg: '#e2e3e5', text: '#383d41', border: '#d6d8db' },
  'Offline':         { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
  'Users Blocked':   { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
  'Failed':          { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
  'Loading':         { bg: '#e2e3e5', text: '#6c757d', border: '#d6d8db' },
  'Unknown':         { bg: '#e2e3e5', text: '#6c757d', border: '#d6d8db' },
}

const DEFAULT_COLORS = STATUS_COLORS['Unknown']

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] ?? DEFAULT_COLORS
  return (
    <span
      className="status-badge"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {status ?? 'Unknown'}
    </span>
  )
}
