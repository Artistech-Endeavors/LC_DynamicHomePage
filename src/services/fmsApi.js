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
 * @returns {Promise<{token: string, baseUrl: string}>}
 */
export async function authenticate(host, port, username, password) {
  const baseUrl = buildBaseUrl(host, port)
  const credentials = btoa(`${username}:${password}`)

  const response = await fetchWithRetry(`${baseUrl}user/auth`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Length': '0',
    },
  })

  if (response.status === 401) {
    throw new Error('Authentication failed: invalid credentials.')
  }
  if (!response.ok) {
    throw new Error(`Authentication failed: HTTP ${response.status}`)
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
 * @returns {Promise<{status: string, isRunning: boolean}>}
 */
export async function getServerStatus(baseUrl, token) {
  const data = await authorizedGet(`${baseUrl}server/status`, token)
  const status = data?.response?.status ?? 'UNKNOWN'
  return { status, isRunning: status === 'RUNNING' }
}

/**
 * GET /server — returns server name, version, ID
 *
 * @param {string} baseUrl
 * @param {string} token
 * @returns {Promise<{serverName: string, version: string, majorVersion: number, id: string}>}
 */
export async function getServerMetadata(baseUrl, token) {
  const data = await authorizedGet(`${baseUrl}server`, token)
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
 * GET /databases — returns list of hosted databases with status and counts
 *
 * @param {string} baseUrl
 * @param {string} token
 * @returns {Promise<{databases: Array, openCount: number, totalCount: number}>}
 */
export async function getDatabases(baseUrl, token) {
  const data = await authorizedGet(`${baseUrl}databases`, token)
  const databases = data?.response?.databases ?? []
  const totalCount = databases.length
  const openCount = databases.filter(db => db.status === 'NORMAL').length
  return { databases, openCount, totalCount }
}

/**
 * GET /server/config/general — general server config
 *
 * @param {string} baseUrl
 * @param {string} token
 */
export async function getServerConfigGeneral(baseUrl, token) {
  return authorizedGet(`${baseUrl}server/config/general`, token)
}

/**
 * Fetch all server details in one call, mirroring "GET Server Details" script order.
 * Returns a unified server status object.
 *
 * @param {string} host
 * @param {string} port
 * @param {string} username
 * @param {string} password
 * @returns {Promise<ServerDetails>}
 */
export async function getServerDetails(host, port, username, password) {
  const { token, baseUrl } = await authenticate(host, port, username, password)

  try {
    const [statusResult, metaResult, dbResult] = await Promise.all([
      getServerStatus(baseUrl, token),
      getServerMetadata(baseUrl, token),
      getDatabases(baseUrl, token),
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function authorizedGet(url, token) {
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Length': '0',
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed: HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

/**
 * Fetch with a single retry on 502 (gateway error), matching the FileMaker script retry pattern.
 */
async function fetchWithRetry(url, options, retries = 1) {
  let response = await fetch(url, options)
  if (response.status === 502 && retries > 0) {
    await sleep(5000)
    response = await fetch(url, options)
  }
  return response
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
