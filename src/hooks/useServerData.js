import { useState, useEffect, useCallback, useRef } from 'react'
import { getFileMakerData } from '../utils/fileMakerBridge'
import { getServerDetails, refreshDatabases, logout } from '../services/fmsApi'

const POLL_INTERVAL_MS = 60_000

/**
 * Map FMS API database status → Lackner Connect Status_ct display values.
 */
function computeStatus(db) {
  switch (db.status) {
    case 'NORMAL':      return 'Running'
    case 'CLOSED':      return 'Closed'
    case 'PAUSED':      return 'Stopped'
    case 'OPENING':     return 'Loading'
    case 'CLOSING':     return 'Stopped'
    case 'MAINTENANCE': return 'Stopped'
    default:            return 'Unknown'
  }
}

/**
 * Transform raw FMS API data into the shape ServerRow expects.
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
      generalStatus: null,
      isClickable: false,
    }]
  }

  return databases.map((db, index) => {
    const clientCount = typeof db.clients === 'number' ? db.clients : null
    return {
      databaseID: db.id ?? index,
      displayName: db.filename?.replace(/\.fmp12$/, '') ?? db.folder ?? `Database ${index + 1}`,
      comments: db.folder ?? '',
      status: computeStatus(db),
      lastVersion: version,
      generalStatus: clientCount !== null
        ? `${clientCount} client${clientCount !== 1 ? 's' : ''}`
        : `${openCount} of ${totalCount} open`,
      isClickable: true,
    }
  })
}

/**
 * Custom hook that manages all server data fetching for the ServerList.
 *
 * Returns:
 *   databases    — array of database items ready for ServerRow, or null
 *   loading      — true during initial load
 *   refreshing   — true during background re-fetches (poll / manual retry)
 *   error        — error message string or null
 *   lastFetched  — Date of last successful fetch, or null
 *   retry        — function to manually trigger a re-fetch
 */
export function useServerData() {
  const [databases, setDatabases]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState(null)
  const [lastFetched, setLastFetched] = useState(null)

  // Persisted auth session — reused across polls to avoid re-authenticating every 60s
  const sessionRef  = useRef(null)   // { baseUrl, token }
  const abortRef    = useRef(null)   // AbortController for the current in-flight fetch
  const configRef   = useRef(null)   // FM config, captured at mount

  const fetchData = useCallback(async ({ isInitial = false, signal } = {}) => {
    const config = configRef.current
    if (!config) return

    const { host, port, username, password, databases: prefetched } = config

    // If FileMaker passed pre-fetched data, use it directly — no API calls needed
    if (prefetched?.length) {
      setDatabases(prefetched)
      setLoading(false)
      setRefreshing(false)
      setLastFetched(new Date())
      return
    }

    if (!host || !username) {
      setError('Missing server configuration. Ensure host and credentials are provided via URL params.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      let details

      // Try to reuse existing auth token; re-authenticate only on 401 or first load
      if (sessionRef.current && !isInitial) {
        try {
          details = await refreshDatabases(sessionRef.current, signal)
        } catch (err) {
          if (signal?.aborted) return
          if (err.status === 401) {
            // Token expired — fall through to full re-auth
            await logout(sessionRef.current.baseUrl, sessionRef.current.token)
            sessionRef.current = null
          } else {
            throw err
          }
        }
      }

      if (!details) {
        details = await getServerDetails(host, port, username, password, signal)
        if (signal?.aborted) return
        sessionRef.current = { baseUrl: details.baseUrl, token: details.token }
      }

      setDatabases(buildDatabaseItems(details))
      setError(null)
      setLastFetched(new Date())
    } catch (err) {
      if (signal?.aborted) return
      setError(err.message ?? 'Failed to connect to server.')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  // Kick off a fetch, cancelling any in-flight request first
  const triggerFetch = useCallback(({ isInitial = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!isInitial) setRefreshing(true)
    fetchData({ isInitial, signal: controller.signal })
  }, [fetchData])

  useEffect(() => {
    configRef.current = getFileMakerData()

    // Initial fetch
    triggerFetch({ isInitial: true })

    // Expose refreshData for "Perform JavaScript In Web Viewer"
    window.refreshData = (jsonData) => {
      if (typeof jsonData === 'string' && jsonData.trim()) {
        try { jsonData = JSON.parse(jsonData) } catch { /* ignore */ }
      }
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        setDatabases(jsonData)
        setLastFetched(new Date())
      } else {
        triggerFetch()
      }
    }

    // Polling — paused when the page/tab is hidden
    let interval = null

    function startPolling() {
      if (interval) return
      interval = setInterval(triggerFetch, POLL_INTERVAL_MS)
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling()
      } else {
        triggerFetch()   // re-fetch immediately on return
        startPolling()
      }
    }

    if (!document.hidden) startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (abortRef.current) abortRef.current.abort()
      if (sessionRef.current) {
        logout(sessionRef.current.baseUrl, sessionRef.current.token)
        sessionRef.current = null
      }
      delete window.refreshData
    }
  }, [triggerFetch])

  return {
    databases,
    loading,
    refreshing,
    error,
    lastFetched,
    retry: triggerFetch,
  }
}
