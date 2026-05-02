/**
 * FileMaker Server Admin API service.
 *
 * API base: https://<host>:<port>/fmi/admin/api/v2/
 * Auth flow: POST user/auth (Basic) → Bearer JWT → use for all calls → DELETE user/auth/<token>
 *
 * Mirrors the logic of the FileMaker scripts:
 *   "Authenticate {serverID,silent}"
 *   "Get Server Status"
 *   "Get Server Metadata"
 *   "Get Databases"
 */

const API_VERSION = 'v2'

function buildBaseUrl(host, port = '443') {
  const scheme = port === '80' ? 'http' : 'https'
  const portSuffix = (scheme === 'https' && port === '443') || (scheme === 'http' && port === '80') ? '' : `:${port}`
  return `${scheme}://${host}${portSuffix}/fmi/admin/api/${API_VERSION}/`
}

/**
 * Authenticate with the FMS Admin API.
 * Matches the FileMaker "Authenticate {serverID,silent}" script logic.
 *
 * @param {string} host
 * @param {string} port
 * @param {string} username
 * @param {string} password
 * @param {AbortSignal} [signal]
 * @returns {Promise<{token: string, baseUrl: string}>}
 */
export async function authenticate(host, port, username, password, signal) {
  const baseUrl = buildBaseUrl(host, port)
  const credentials = btoa(`${username}:${password}`)

  const response = await fetchWithRetry(`${baseUrl}user/auth`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Length': '0',
    },
    signal,
  })

  if (response.status === 401) {
    const err = new Error('Authentication failed: invalid credentials.')
    err.status = 401
    throw err
  }
  if (!response.ok) {
    const err = new Error(`Authentication failed: HTTP ${response.status}`)
    err.status = response.status
    throw err
  }

  const data = await response.json()
  const token = data?.response?.token
  if (!token) {
    throw new Error('Authentication failed: no token in response.')
  }

  return { token, baseUrl }
}

/**
 * Invalidate an existing auth token.
 *
 * @param {string} baseUrl
 * @param {string} token
 */
export async function logout(baseUrl, token) {
  try {
    await fetch(`${baseUrl}user/auth/${token}`, { method: 'DELETE' })
  } catch {
    // ignore logout errors
  }
}

/**
 * GET /server/status — returns "RUNNING" | "STOPPED"
 *
 * @param {string} baseUrl
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{status: string, isRunning: boolean}>}
 */
export async function getServerStatus(baseUrl, token, signal) {
  const data = await authorizedGet(`${baseUrl}server/status`, token, signal)
  const status = data?.response?.status ?? 'UNKNOWN'
  return { status, isRunning: status === 'RUNNING' }
}

/**
 * GET /server — returns server name, version, ID
 *
 * @param {string} baseUrl
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{serverName: string, version: string, majorVersion: number, id: string}>}
 */
export async function getServerMetadata(baseUrl, token, signal) {
  const data = await authorizedGet(`${baseUrl}server`, token, signal)
  const resp = data?.response ?? {}
  const versionString = resp.versionString ?? ''
  const majorVersion = parseInt(versionString.split('.')[0], 10) || 0
  return {
    serverName: resp.ServerName ?? '',
    version: versionString,
    majorVersion,
    id: resp.id ?? '',
  }
}

/**
 * GET /databases — returns list of hosted databases with status and client counts
 *
 * @param {string} baseUrl
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{databases: Array, openCount: number, totalCount: number}>}
 */
export async function getDatabases(baseUrl, token, signal) {
  const data = await authorizedGet(`${baseUrl}databases`, token, signal)
  const databases = data?.response?.databases ?? []
  const totalCount = databases.length
  const openCount = databases.filter(db => db.status === 'NORMAL').length
  return { databases, openCount, totalCount }
}

/**
 * Fetch all server details in one call (full auth + parallel GETs).
 * Use this for the initial load or after a token expiry.
 *
 * @param {string} host
 * @param {string} port
 * @param {string} username
 * @param {string} password
 * @param {AbortSignal} [signal]
 * @returns {Promise<ServerDetails>}
 */
export async function getServerDetails(host, port, username, password, signal) {
  const { token, baseUrl } = await authenticate(host, port, username, password, signal)

  try {
    const [statusResult, metaResult, dbResult] = await Promise.all([
      getServerStatus(baseUrl, token, signal),
      getServerMetadata(baseUrl, token, signal),
      getDatabases(baseUrl, token, signal),
    ])

    return {
      isRunning: statusResult.isRunning,
      serverStatus: statusResult.status,
      serverName: metaResult.serverName,
      version: metaResult.version,
      majorVersion: metaResult.majorVersion,
      serverId: metaResult.id,
      databases: dbResult.databases,
      openCount: dbResult.openCount,
      totalCount: dbResult.totalCount,
      baseUrl,
      token,
    }
  } catch (err) {
    await logout(baseUrl, token)
    throw err
  }
}

/**
 * Refresh server data using an existing auth token (no re-authentication).
 * Throws an error with status=401 if the token has expired.
 *
 * @param {{ baseUrl: string, token: string }} session
 * @param {AbortSignal} [signal]
 * @returns {Promise<ServerDetails>}
 */
export async function refreshDatabases({ baseUrl, token }, signal) {
  const [statusResult, metaResult, dbResult] = await Promise.all([
    getServerStatus(baseUrl, token, signal),
    getServerMetadata(baseUrl, token, signal),
    getDatabases(baseUrl, token, signal),
  ])

  return {
    isRunning: statusResult.isRunning,
    serverStatus: statusResult.status,
    serverName: metaResult.serverName,
    version: metaResult.version,
    majorVersion: metaResult.majorVersion,
    serverId: metaResult.id,
    databases: dbResult.databases,
    openCount: dbResult.openCount,
    totalCount: dbResult.totalCount,
    baseUrl,
    token,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function authorizedGet(url, token, signal) {
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Length': '0',
    },
    signal,
  })

  if (response.status === 401) {
    const err = new Error(`Unauthorized: token expired or invalid.`)
    err.status = 401
    throw err
  }
  if (!response.ok) {
    const err = new Error(`API request failed: HTTP ${response.status} for ${url}`)
    err.status = response.status
    throw err
  }

  return response.json()
}

/**
 * Fetch with a single retry on 502 (gateway error), matching the FileMaker script retry pattern.
 * Does not retry if the request was aborted.
 */
async function fetchWithRetry(url, options, retries = 1) {
  let response = await fetch(url, options)
  if (response.status === 502 && retries > 0 && !options.signal?.aborted) {
    await sleep(5000)
    response = await fetch(url, options)
  }
  return response
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
