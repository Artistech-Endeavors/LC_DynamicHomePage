/**
 * StatusBadge — colored pill badge showing a database/server status.
 *
 * Status values (matching FileMaker Status_ct field):
 *   Ready, Running, Update Available, Stopped, Closed, Offline, Users Blocked, Failed, Loading, Unknown
 *
 * Colors are defined as CSS classes in App.css for easy theming.
 */

export default function StatusBadge({ status }) {
  const slug = (status ?? 'unknown')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  return (
    <span className={`status-badge status-badge--${slug}`}>
      {status ?? 'Unknown'}
    </span>
  )
}
