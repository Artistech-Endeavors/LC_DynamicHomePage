/**
 * FileMaker Web Viewer bridge utilities.
 *
 * FileMaker passes data to this Web Viewer via URL query parameters:
 *   host        - FMS hostname or IP address
 *   port        - Admin API port (default 443)
 *   username    - Admin API username
 *   password    - Admin API password
 *   databases   - JSON array of configured database objects (optional pre-fetched data)
 *
 * FileMaker can also inject a global window.FileMakerData object before the page loads.
 */

/**
 * Parse configuration injected by FileMaker.
 * Priority: window.FileMakerData > URL query params.
 */
export function getFileMakerData() {
  const injected = window.FileMakerData ?? {}

  const params = new URLSearchParams(window.location.search)
  const fromUrl = {
    host: params.get('host') ?? '',
    port: params.get('port') ?? '443',
    username: params.get('username') ?? '',
    password: params.get('password') ?? '',
    databases: params.get('databases') ? tryParseJSON(params.get('databases')) : null,
  }

  return {
    host: injected.host ?? fromUrl.host,
    port: injected.port ?? fromUrl.port,
    username: injected.username ?? fromUrl.username,
    password: injected.password ?? fromUrl.password,
    databases: injected.databases ?? fromUrl.databases ?? null,
  }
}

/**
 * Trigger a FileMaker script from JavaScript.
 * Silently no-ops when running outside of a FileMaker Web Viewer.
 *
 * @param {string} scriptName - Exact FileMaker script name
 * @param {object|string} [param] - Parameter passed as JSON string
 */
export function performScript(scriptName, param) {
  if (!window.FileMaker) return
  const paramStr = param === undefined ? '' : (typeof param === 'string' ? param : JSON.stringify(param))
  window.FileMaker.PerformScript(scriptName, paramStr)
}

/**
 * Launch a database via the existing FileMaker script.
 *
 * @param {string|number} databaseID
 */
export function launchDatabase(databaseID) {
  performScript('Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}', { databaseID: String(databaseID) })
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}
