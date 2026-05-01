import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import ServerList from './components/ServerList'
import { getFileMakerData } from './utils/fileMakerBridge'
import { getServerDetails } from './services/fmsApi'

const POLL_INTERVAL_MS = 60_000

/**
 * Map FMS API database status + server state → Lackner Connect Status_ct values.
 */
function computeStatus(db, serverBlocked) {
  if (serverBlocked) return 'Users Blocked'
  switch (db.status) {
    case 'NORMAL':   return 'Running'
    case 'CLOSED':   return 'Closed'
    case 'PAUSED':   return 'Stopped'
    case 'OPENING':  return 'Loading'
    case 'CLOSING':  return 'Stopped'
    case 'MAINTENANCE': return 'Stopped'
    default:         return 'Unknown'
  }
}

/**
 * Transform raw FMS API database + server details into the shape ServerRow expects.
 */
function buildDatabaseItems(fmsData) {
  const { databases, serverName, version, openCount, totalCount, isRunning } = fmsData

  if (!isRunning) {
    return [{
      databaseID: null,
      displayName: serverName || 'Server',
      comments: 'The server is not running.',
      status: 'Stopped',
      lastVersion: version,
      generalStatus: `${serverName}`,
      isClickable: false,
    }]
  }

  return databases.map((db, index) => ({
    databaseID: db.id ?? index,
    displayName: db.filename?.replace(/\.fmp12$/, '') ?? db.folder ?? `Database ${index + 1}`,
    comments: db.folder ?? '',
    status: computeStatus(db, false),
    lastVersion: version,
    generalStatus: `${openCount} of ${totalCount} open`,
    isClickable: true,
  }))
}

function App() {
  const [databases, setDatabases] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const tokenRef = useRef(null)
  const baseUrlRef = useRef(null)

  const fetchData = useCallback(async (config) => {
    const { host, port, username, password, databases: prefetched } = config

    // If FileMaker passed pre-fetched data, use it directly
    if (prefetched?.length) {
      setDatabases(prefetched)
      setLoading(false)
      return
    }

    if (!host || !username) {
      setError('Missing server configuration. Ensure host and credentials are provided.')
      setLoading(false)
      return
    }

    try {
      const details = await getServerDetails(host, port, username, password)
      tokenRef.current = details.token
      baseUrlRef.current = details.baseUrl
      setDatabases(buildDatabaseItems(details))
      setError(null)
    } catch (err) {
      setError(err.message ?? 'Failed to connect to server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const config = getFileMakerData()
    fetchData(config)

    // Expose refreshData for FileMaker to call via "Perform JavaScript In Web Viewer"
    window.refreshData = (jsonData) => {
      if (typeof jsonData === 'string') {
        try { jsonData = JSON.parse(jsonData) } catch { /* ignore */ }
      }
      if (Array.isArray(jsonData)) {
        setDatabases(jsonData)
      } else {
        fetchData(config)
      }
    }

    // Poll for live updates every 60 seconds
    const interval = setInterval(() => fetchData(config), POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      delete window.refreshData
    }
  }, [fetchData])

  return (
    <div className="app">
      <ServerList
        databases={databases}
        loading={loading}
        error={error}
      />
    </div>
  )
}

export default App
