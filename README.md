# LC Dynamic Home Page

A React + Vite web app that replaces the static database portal on the **Home** layout of the **Lackner Connect** FileMaker solution. It fetches live data from the FileMaker Server (FMS) Admin API and renders a styled, interactive server/database list inside a FileMaker Web Viewer.

The app compiles to a **single self-contained `dist/index.html`** file — no web server, no external assets. FileMaker loads it directly from disk or a container field.

---

## How It Works

```
FileMaker (Home layout)
  └── Web Viewer  ←── dist/index.html
        │
        │  URL params: host, port, username, password
        ↓
    React App
        │
        ├── fmsApi.js  ──POST /fmi/admin/api/v2/user/auth──→  FMS Admin API
        │                         (JWT token)
        │              ──GET /server/status, /server, /databases──→
        │
        └── Renders database list
              │
              └── Row click ──FileMaker.PerformScript()──→  "Button: Launch DB" script
```

**Data flow:**
1. FileMaker sets the Web Viewer URL, injecting the server host/credentials as query params
2. The React app authenticates with the FMS Admin API and fetches server status + database list
3. The list auto-refreshes every 60 seconds (matches the existing FM portal refresh behavior)
4. Clicking a database row calls the same FM script the original portal buttons called — no FM script changes needed
5. FileMaker can also push data updates directly via `Perform JavaScript In Web Viewer`

---

## Project Structure

```
LC_DynamicHomePage/
├── src/
│   ├── App.jsx                    # Root component — fetch, poll, refreshData
│   ├── App.css                    # Portal-matching styles
│   ├── main.jsx                   # React root render
│   ├── utils/
│   │   └── fileMakerBridge.js     # URL param parsing + FM.PerformScript() wrapper
│   ├── services/
│   │   └── fmsApi.js              # FMS Admin API: auth, status, databases
│   └── components/
│       ├── ServerList.jsx         # Up to 5 rows, sorted, loading/error/empty states
│       ├── ServerRow.jsx          # Single database row (icon, name, comments, badge)
│       └── StatusBadge.jsx        # Colored status pill
├── AGENTS/
│   ├── plan.md                    # Original implementation plan
│   ├── research.md                # FM field mappings, API docs, script analysis
│   └── fm-integration.md         # Full FileMaker integration reference
├── dist/
│   └── index.html                 # ← Compiled output. This is what FileMaker loads.
├── index.html                     # Vite entry point (not the output)
└── vite.config.js                 # Single-file build config
```

---

## Development Setup

**Prerequisites:** Node.js 18+, npm

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev
# Opens at http://localhost:5173

# Build for FileMaker (output: dist/index.html)
npm run build
```

### Running locally with a live FMS server

Pass credentials as URL params to the dev server:
```
http://localhost:5173?host=fms.artistechendeavors.com&port=443&username=admin&password=yourpassword
```

### Testing with mock data (no FMS connection)

Open the built file with a `databases` param to skip API calls entirely:
```
file:///path/to/dist/index.html?databases=[{"databaseID":"1","displayName":"Test DB","status":"Ready","lastVersion":"21.0","generalStatus":"2 of 3 open","isClickable":true}]
```

---

## FileMaker Integration

### 1. Build the app

```bash
npm run build
```

Output is `dist/index.html` (~202 kB, all JS and CSS inlined).

### 2. Make the file accessible to FileMaker clients

**Option A — Local file path** (simplest for dev/testing)
Copy `dist/index.html` to a known path on the client machine (e.g. Desktop).

**Option B — Container field** (recommended for deployment)
Store `dist/index.html` in a FileMaker container field, e.g. `Session::WebViewerHTML_c`.

**Option C — Web server**
Host at any HTTPS URL. Required if CORS blocks `file://` requests to the FMS Admin API (see [CORS](#cors) below).

### 3. Replace the portal with a Web Viewer

In Layout mode on the **Home** layout:
1. Delete (or hide) the existing `Session|Databases` portal
2. Insert a **Web Viewer** object in the same position/size
3. Name the object `serverListViewer`
4. Set the URL to the calculation below
5. Enable ☑ **Allow JavaScript to perform FileMaker scripts**

#### Web Viewer URL calculation (Option A — local file)
```
"file://" & Get(DesktopPath) & "index.html" &
"?host="     & URLEncode ( FMSServerList::baseConfig_IPAddress_t ) &
"&port="     & URLEncode ( FMSServerList::baseConfig_IPAddress_APIPort_t ) &
"&username=" & URLEncode ( FMSServerList::adminConsole_customLogin_t ) &
"&password=" & URLEncode ( FMSServerList::adminConsole_customPassword_t )
```

#### Web Viewer URL calculation (Option B — container field)
```
"container:" & GetAsURL ( Session::WebViewerHTML_c ) &
"?host="     & URLEncode ( FMSServerList::baseConfig_IPAddress_t ) &
"&port="     & URLEncode ( FMSServerList::baseConfig_IPAddress_APIPort_t ) &
"&username=" & URLEncode ( FMSServerList::adminConsole_customLogin_t ) &
"&password=" & URLEncode ( FMSServerList::adminConsole_customPassword_t )
```

### URL Parameters Reference

| Parameter | Required | Description |
|-----------|----------|-------------|
| `host` | Yes | FMS hostname or IP address |
| `port` | No (default `443`) | Admin API port |
| `username` | Yes | Admin Console username |
| `password` | Yes | Admin Console password |
| `databases` | No | JSON array of pre-fetched database objects (bypasses API calls — see CORS) |

All values must be URL-encoded with FileMaker's `URLEncode()` function.

---

## Pushing Updates from FileMaker

After the Web Viewer loads, FileMaker can push data or trigger a re-fetch at any time:

```
Perform JavaScript in Web Viewer [
  Object Name: "serverListViewer";
  Function Name: "refreshData";
  Parameters: $databasesJson    // JSON array string, OR empty string to re-fetch from API
]
```

- **Pass a JSON array** → replaces the displayed list immediately (no API call)
- **Pass empty string** → triggers a full re-fetch from the FMS Admin API

This is useful after a `Verify Databases` or `NAV: Home` script run to sync the display without waiting for the 60-second poll.

### JSON format for the `databases` param / `refreshData`

```json
[
  {
    "databaseID": "1",
    "displayName": "Client Database",
    "comments": "Production",
    "status": "Ready",
    "lastVersion": "21.0.1",
    "generalStatus": "5 of 6 open",
    "isClickable": true
  }
]
```

**Valid `status` values:** `Ready` | `Running` | `Update Available` | `Loading` | `Stopped` | `Closed` | `Offline` | `Users Blocked` | `Failed` | `Unknown`

---

## Row Click → FileMaker Script

When a user clicks a database row, the app calls:
```javascript
window.FileMaker.PerformScript(
  "Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}",
  JSON.stringify({ databaseID: "1" })
)
```

This is the **exact script and parameter format** used by the original portal buttons. No FileMaker script changes are required.

---

## CORS

The FMS Admin API may reject requests from a `file://` origin. If you see network errors in the Web Viewer console, use one of these approaches:

**Option A — Pre-fetch in FileMaker (recommended)**
Run `GET Server Details` in FileMaker before loading the Web Viewer, build the JSON array from the result, and pass it as the `databases` URL parameter. The React app will render it directly with no API calls.

**Option B — Host on HTTPS**
Deploy `dist/index.html` to any HTTPS host (or the FMS web root at `/httpsRoot/`). Load it via `https://` in the Web Viewer. Same-origin HTTPS requests are allowed by FMS.

**Option C — Configure FMS CORS**
In FMS Admin Console → Configuration → Security, add `file://` (or your hosting domain) to the allowed CORS origins.

---

## Status Values

The app maps FMS Admin API database statuses to Lackner Connect display values:

| FMS Status | Display | Badge Color |
|------------|---------|-------------|
| `NORMAL` | Running | Blue |
| `NORMAL` + LGI check | Ready | Green |
| `CLOSED` | Closed | Gray |
| `PAUSED` / `CLOSING` / `MAINTENANCE` | Stopped | Orange |
| `OPENING` | Loading | Light blue |
| Server offline | Offline | Red |
| `blockNewUsers` | Users Blocked | Red |

> **Note:** "Ready" vs "Running" and "Update Available" statuses in the original FM system are computed via the **LGI Tools** external API (`LGITools_ServerStatus_IsOnline_cb`). The React app currently maps `NORMAL` → `Running`. To show `Ready`, pass pre-fetched data from FileMaker with the correct status string already set.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/services/fmsApi.js` | All FMS Admin API calls. Edit here to change API endpoints or add new calls. |
| `src/utils/fileMakerBridge.js` | URL param parsing and `FileMaker.PerformScript()` wrapper. |
| `src/App.jsx` | Fetch logic, 60s polling, `window.refreshData()` global. |
| `src/components/StatusBadge.jsx` | Add/change status colors here (`STATUS_COLORS` map). |
| `src/components/ServerList.jsx` | Change `MAX_ROWS` (currently `5`) or sort order here. |
| `vite.config.js` | Single-file build config via `vite-plugin-singlefile`. |
| `AGENTS/research.md` | FM field names, API endpoint specs, original script logic. |
| `AGENTS/fm-integration.md` | Full FileMaker integration reference with more examples. |

---

## Making Changes

1. Edit source files in `src/`
2. Test with `npm run dev` (pass URL params for a real server or use mock `databases` param)
3. Build: `npm run build`
4. Replace `dist/index.html` in FileMaker (container field or file path)

The build output is a single file with no external dependencies — just swap the file and refresh the Web Viewer.
