# LC_DynamicHomePage — Implementation Plan

## Problem Statement
Replace the FileMaker portal-based server/database list on the "Home" layout of Lackner Connect with a React + Vite web application rendered in a FileMaker Web Viewer. The React app must communicate with the FileMaker Server (FMS) Admin API to display live server and database status, match the existing FileMaker portal appearance, and allow row-click actions to trigger FileMaker scripts.

## Approach
1. Initialize a Vite + React project in this repository
2. Build a self-contained single-file HTML output (using `vite-plugin-singlefile`) so FileMaker's Web Viewer can load it from a local path or container
3. FileMaker injects server credentials and the database list as URL query parameters when constructing the Web Viewer URL
4. The React app calls the FMS Admin API directly (in-browser) to authenticate and fetch live status
5. Row clicks trigger `FileMaker.PerformScript()` to invoke existing FileMaker scripts unchanged

---

## Project Structure
```
LC_DynamicHomePage/
├── AGENTS/
│   ├── plan.md          (this file)
│   └── research.md      (all gathered data & analysis)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── components/
│   │   ├── ServerList.jsx       — renders the list of database rows
│   │   ├── ServerRow.jsx        — single database entry row
│   │   └── StatusBadge.jsx      — colored status pill
│   ├── services/
│   │   └── fmsApi.js            — FMS Admin API calls (auth, status, databases)
│   └── utils/
│       └── fileMakerBridge.js   — FileMaker.PerformScript() wrapper + URL param parsing
├── index.html
├── vite.config.js
└── package.json
```

---

## Todos

### Phase 1 — Project Scaffolding
- [ ] `scaffold-vite` — Initialize Vite + React project (`npm create vite@latest . -- --template react`)
- [ ] `install-deps` — Install dependencies: `vite-plugin-singlefile`, standard React deps
- [ ] `vite-config` — Configure `vite.config.js` for single-file output targeting FileMaker Web Viewer

### Phase 2 — FileMaker Bridge
- [ ] `filemaker-bridge` — Implement `src/utils/fileMakerBridge.js`:
  - Parse URL query params: `host`, `port`, `username`, `password`, `databases` (JSON array)
  - Expose `performScript(name, param)` wrapper for `window.FileMaker.PerformScript()`
  - Expose `callScriptWithResult(name, param)` if needed

### Phase 3 — FMS Admin API Service
- [ ] `fms-api-service` — Implement `src/services/fmsApi.js`:
  - `authenticate(baseUrl, username, password)` → Bearer JWT token
  - `getServerStatus(baseUrl, token)` → `{status: "RUNNING"|"STOPPED"}`
  - `getServerMetadata(baseUrl, token)` → `{serverName, version, id}`
  - `getDatabases(baseUrl, token)` → array of database objects with status, counts
  - `logout(baseUrl, token)` → cleanup
  - Auto re-auth on 401
  - Handle retry on 502 (gateway error), consistent with the FileMaker script pattern

### Phase 4 — React Components
- [ ] `comp-status-badge` — `StatusBadge.jsx`:
  - Props: `status` (string)
  - Status → color mapping: Ready=green, Running=blue, Update Available=amber, Stopped=orange, Closed=gray, Offline=red, Users Blocked=red, Failed=red

- [ ] `comp-server-row` — `ServerRow.jsx`:
  - Props: `database` (object with displayName, comments, status, lastVersion, generalStatus, databaseID, icon)
  - Two-line layout: name (large) + comments (small/muted)
  - Right side: StatusBadge + version text + general status
  - Click handler: calls `performScript("Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}", {databaseID})`

- [ ] `comp-server-list` — `ServerList.jsx`:
  - Props: `databases[]`, `loading`, `error`
  - Renders up to 5 rows (matching portal `[1..5]` behavior)
  - Sorted ascending by `displayName`
  - Loading state: spinner/shimmer
  - Error state: message display
  - Empty state: "No databases configured" message

- [ ] `comp-app` — `App.jsx`:
  - On mount: parse credentials from URL params via `fileMakerBridge`
  - Authenticate with FMS Admin API via `fmsApi`
  - Fetch server status + databases
  - Poll for refresh every 60 seconds (matching `StatusCheck_Timestamp_ts` 60-second threshold in FM scripts)
  - Expose `window.refreshData(jsonData)` for FileMaker to call directly
  - Manage: `loading`, `error`, `databases[]` state

### Phase 5 — Styling
- [ ] `styles` — `App.css`:
  - Match FileMaker portal appearance: light gray background, thin row separators
  - System font stack (SF Pro / Segoe UI / system-ui)
  - Row hover effect (light blue highlight)
  - Status badge pill styling
  - Alternating row shading to match FM portal
  - Full-width, no margins/padding (Web Viewer fills the container)

### Phase 6 — Build & Validation
- [ ] `build-verify` — Run `npm run build`, verify output is a single `dist/index.html` with all JS/CSS inlined
- [ ] `fm-integration-notes` — Document how FileMaker should construct the Web Viewer URL and pass data

---

## Data Flow

### FileMaker → React (on Web Viewer load)
FileMaker constructs the Web Viewer URL with encoded parameters:
```
file:///path/to/dist/index.html?host=192.168.1.10&port=443&user=admin&pass=••com&databases=[{...}]
```
Or via injected `window.FileMakerData` global.

The `databases` param is a JSON array with each entry:
```json
[
  {
    "databaseID": 1,
    "displayName": "Client DB",
    "comments": "Production server",
    "location": "192.168.1.10",
    "adminPort": "443",
    "username": "admin",
    "password": "••com",
    "lastStatus": "Ready",
    "lastVersion": "21.0.1",
    "disabled": false
  }
]
```

### React → FileMaker (on row click)
```javascript
window.FileMaker.PerformScript(
  "Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}",
  JSON.stringify({ databaseID: 1 })
);
```

### React API Calls (browser → FMS Admin API)
```
POST https://<host>:<port>/fmi/admin/api/v2/user/auth          → get JWT
GET  https://<host>:<port>/fmi/admin/api/v2/server/status      → RUNNING/STOPPED
GET  https://<host>:<port>/fmi/admin/api/v2/server             → name, version, ID
GET  https://<host>:<port>/fmi/admin/api/v2/databases          → database list + counts
```

---

## Key Decisions

### Single-File Build
Using `vite-plugin-singlefile` to produce a single `dist/index.html` with all assets inlined. This allows FileMaker to load the file from a local path or store it in a container field without needing a web server.

### Direct API Calls from Browser
The React app calls the FMS Admin API directly (not proxied through FileMaker). This means:
- Credentials must be passed to the Web Viewer
- CORS must be allowed on the FMS Admin API (FMS allows same-origin and configured origins; local `file://` may need special handling)
- If CORS is a blocker, fallback: FileMaker fetches data and passes it to React as a `window` global

### No Backend Required
The app is entirely static — no Node.js server, no proxy. Pure client-side React + Vite.

### FileMaker Script Names (Unchanged)
The React app calls the exact same script names as the existing portal buttons. This ensures zero changes needed to existing FileMaker logic.

---

## CORS Consideration
FMS Admin API may block `file://` origin requests. If that occurs:
- **Fallback A**: FileMaker fetches all data via its own API scripts, serializes to JSON, and passes to the Web Viewer via URL param or `Perform JavaScript In Web Viewer`
- **Fallback B**: Use a `data:` URI or hosted URL instead of `file://`
- **Recommended**: Test at integration time; design the `fmsApi.js` service so it can be bypassed if FileMaker passes pre-fetched data

---

## Notes
- The FileMaker portal currently shows max 5 rows; the React component should match this behavior
- Status badge "Update Available" corresponds to the `Status_Update_ct` field in FileMaker
- The `Status_General_ct` field shows combined status text (open DBs of total, cert warnings, etc.)
- Certificate expiry warning should appear when `API_CertificateInfo_Ex_Expires_cd < today`
- `FMS_Databases_CountWaitingForRequired_Opening_cb > 0` means files are still opening (show loading indicator)
- The default admin credentials in the existing system are "lackner"/"lackner" but are configurable per-server
