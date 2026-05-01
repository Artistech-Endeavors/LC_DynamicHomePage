# LC_DynamicHomePage — Research Notes

## Project Overview
A React + Vite app that replaces the server/database list portal on the "Home" layout in Lackner Connect (FileMaker). It compiles to a single self-contained HTML file, loaded in a FileMaker Web Viewer.

---

## Current FileMaker Portal (Screenshot: IMG_0022.jpeg)

The portal is named `Session|Databases [1..5, Sort, Filter]` and shows **up to 5 rows**, sorted ascending by `Databases::DisplayName_ct`.

### Column Layout (left to right)
| Column | FileMaker Field | Description |
|--------|----------------|-------------|
| 1 | `Icon_cont_b` | Server/database type icon |
| 2 | `DisplayName_ct` | Primary display name |
| 3 | `Comments_ct` | Notes/description |
| 4 | `Status_Update_ct` | Status badge (has sort indicator — dropdown/clickable) |
| 5 | `Status_LastVer...` | Last version string (truncated) |
| 6 | `Status_General_ct` | General status text |

---

## FileMaker Data Tables

### `Databases` Table (portal source)
| Field | Type | Description |
|-------|------|-------------|
| `DatabaseID` | Number | Primary key |
| `DisplayName_ct` | Calc Text | Display name for UI |
| `Comments_ct` | Calc Text | Comments/notes |
| `Status_ct` | Calc Text | Current status |
| `Status_Update_ct` | Calc Text | Update status badge |
| `Status_LastVersion_t` | Text | Last known version string |
| `Status_General_ct` | Calc Text | General status |
| `StatusCheck_Result_t` | Text | "Offline" or result text |
| `StatusCheck_Timestamp_ts` | Timestamp | When status was last checked |
| `Status_LastSuccessfulLaunch_ts` | Timestamp | Last successful launch time |
| `Location` | Text | IP address / hostname |
| `Location_AdminAPIPort_t` | Text | Admin API port |
| `Location_WithPort_ct` | Calc Text | `hostname:port` |
| `Disabled_b` | Boolean | Skip disabled entries |
| `ConnectionType_IsServer_cn` | Calc Boolean | Is a server connection |
| `ConnectionType_IsStandalone_cn` | Calc Boolean | Is standalone |
| `SoftwareTitle_t` | Text | e.g. "FileMaker Pro" |
| `SoftwareTitle_Is6in1_cb` | Boolean | Is 6-in-1 type |
| `SoftwareTitle_IsInheriTax_cb` | Boolean | Is InheriTax type |
| `StartFile_PNE_FMP_ct` | Calc Text | Path to start .fmp12 file |
| `StartFile_Exists_cn` | Calc Boolean | Does start file exist |
| `FMS_Databases_CountWaitingForRequired_Opening_cb` | Calc | Files still opening |
| `Status_IgnoreOnLaunch_b` | Boolean | Skip status check on launch |
| `API_UserContextSummary_json_t` | Text | API user context JSON |

### `FMSServerList` Table (server records, related to Databases)
| Field | Type | Description |
|-------|------|-------------|
| `PKID` | Number | Primary key |
| `baseConfig_IPAddress_t` | Text | Server IP/hostname |
| `baseConfig_IPAddress_APIPort_t` | Text | Admin API port |
| `baseConfig_IPAddress_WithPort_ct` | Calc Text | `host:port` |
| `baseConfig_AdminAPI_BaseEndpoint_ct` | Calc Text | Full API base URL |
| `baseConfig_DisplayName_t` | Text | Server display name |
| `adminConsole_customLogin_t` | Text | Admin API username (default: "lackner") |
| `adminConsole_customPassword_t` | Text | Admin API password (default: "lackner") |
| `API_RESPONSE_Auth_Token_json_t` | Text | Cached auth JWT response |
| `API_RESPONSE_GET_ServerStatus_json_t` | Text | Cached server status response |
| `API_RESPONSE_GET_ServerMetadata_json_t` | Text | Cached server metadata response |
| `API_RESPONSE_GET_Databases_json_t` | Text | Cached databases list response |
| `API_RESPONSE_GET_ServerConfigGeneral_json_t` | Text | Cached general config response |
| `API_RESPONSE_GET_ServerCurrentFolderSettings_json_t` | Text | Cached folder settings |
| `API_RESPONSE_GET_LicenseInfo_json_t` | Text | Cached license info |
| `API_RESPONSE_GET_CertificateInfo_json_t` | Text | Cached certificate info |
| `API_ServerStatus_Status_ct` | Calc Text | "RUNNING" / "STOPPED" |
| `API_ServerStatus_IsRunning_cb` | Calc Boolean | Is server running |
| `API_ServerStatus_IsBlockNewUsers_cb` | Calc Boolean | Users blocked (maintenance) |
| `API_ServerMetadata_ServerID_ct` | Calc Text | Server UUID |
| `API_ServerMetadata_ServerName_ct` | Calc Text | Server name |
| `API_ServerMetadata_ServerVersion_Maj_ct` | Calc Number | Major FMS version |
| `API_Databases_openDBCount_cn` | Calc Number | Open database count |
| `API_Databases_totalDBCount_cn` | Calc Number | Total database count |
| `API_CertificateInfo_HasCustomSSL_SecureClient_cb` | Calc Boolean | Has custom SSL cert |
| `API_CertificateInfo_Ex_Expires_cd` | Calc Date | Cert expiry date |
| `API_CertificateInfo_Ex_CN_ct` | Calc Text | Cert Common Name |
| `API_LicenseInfo_ExpirationTime_cd` | Calc Date | License expiry date |
| `LGITools_RESPONSE_PUT_ServerStatus_json_t` | Text | LGI API server status JSON |
| `LGITools_ServerStatus_IsOnline_cb` | Calc Boolean | Online per LGI API |
| `LGITools_ServerStatus_Message_ct` | Calc Text | LGI status message |
| `ModificationTimestamp` | Timestamp | Last record modification |

---

## FMS Admin API

### Base URL
```
https://<hostname>:<port>/fmi/admin/api/v2/
```
- Default port for FMS Admin API: `443` (HTTPS)
- Stored per-server in: `FMSServerList::baseConfig_AdminAPI_BaseEndpoint_ct`

### Authentication Flow
1. **Login** — `POST user/auth`
   - Header: `Authorization: Basic <base64(username:password)>`
   - Header: `Content-Length: 0`
   - Response: `{"response":{"token":"<JWT>"},"messages":[{"code":"0","text":"OK"}]}`
   - HTTP 200 = success, HTTP 401 = unauthorized
2. **Subsequent calls** — `Authorization: Bearer <JWT>`
3. **Logout** — `DELETE user/auth/<token>`

### Key Endpoints

#### `GET server/status`
Returns whether the Database Server is running.
```json
{ "response": { "status": "RUNNING" }, "messages": [...] }
```
Status: `"RUNNING"` | `"STOPPED"`

#### `GET server`
Returns server metadata.
```json
{
  "response": {
    "ServerName": "My Server",
    "versionString": "21.0.1.500",
    "id": "abc-123-uuid"
  }
}
```

#### `GET databases`
Returns list of hosted databases.
```json
{
  "response": {
    "databases": [
      {
        "id": 123,
        "filename": "MyDB.fmp12",
        "folder": "/",
        "status": "NORMAL",
        "clients": 0
      }
    ]
  }
}
```
- `status` values: `"NORMAL"`, `"CLOSED"`, `"PAUSED"`, `"OPENING"`, `"CLOSING"`, `"MAINTENANCE"`

#### `GET server/config/general` (requires FMS v21+)
General server configuration.

#### `GET server/config/blockNewUsers` (FMS v21+)
Returns whether new user connections are blocked.

#### `GET server/config/security`
Returns `requireSecureDB` setting.

### Status → Lackner Connect Status Mapping
| FMS API status | LC `Status_ct` | Meaning |
|----------------|----------------|---------|
| RUNNING + DB NORMAL | "Ready" | Normal operation |
| RUNNING (currently in use) | "Running" | Active sessions |
| Update available | "Update Available" | Needs update |
| STOPPED | "Stopped" | Server stopped |
| DB CLOSED | "Closed" | Database closed |
| Server unreachable | "Offline" | No API response |
| `blockNewUsers = true` | "Users Blocked" | Maintenance mode |

---

## FileMaker Scripts (Key Scripts)

### `GET Server Details {serverID,forceRefresh,clearAllFirst,silent}`
Master script that calls sub-scripts in order:
1. LGI Tools server status upsert (if server ID known)
2. `Get Server Status` → `API_RESPONSE_GET_ServerStatus_json_t`
3. `Get Server Metadata` → `API_RESPONSE_GET_ServerMetadata_json_t`
4. `Get Server Config BlockNewUsers` (if FMS v21+)
5. `Get Databases` → `API_RESPONSE_GET_Databases_json_t`
6. LGI API server status (if empty)
7. `Get Server Config General` → `API_RESPONSE_GET_ServerConfigGeneral_json_t`
8. `Get Current Folder Settings` → `API_RESPONSE_GET_ServerCurrentFolderSettings_json_t`

### `Authenticate {serverID,silent}`
- Deletes old token if exists
- POSTs to `user/auth` with Basic auth
- Stores response in `API_RESPONSE_Auth_Token_json_t`
- Credentials from `adminConsole_customLogin_t` / `adminConsole_customPassword_t`
- Default credentials if empty: "lackner" / "lackner"

### `Get Databases`
- Calls `Do Request` with endpoint `databases`
- Stores response in `FMSServerList::API_RESPONSE_GET_Databases_json_t`

### `Do Request {endPoint,baseCurl, etc.}`
- Wraps all API calls, handles auth token injection and re-auth on 401

### `Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}`
Called when user clicks a database row. Logic:
1. Find database record
2. Ping LGI Tools API
3. Refresh status if >60 seconds old
4. Fail if `Status_ct` = "Stopped" or "Closed"
5. Fail if `API_ServerStatus_IsBlockNewUsers_cb` = true
6. Fail if required files still opening
7. Fail if start file DB status not normal
8. Otherwise: Close other windows → launch via `Launch Current DB using THIS FILE`

### `Verify Databases {forceRefresh=false}`
Loops over all enabled databases (sorted by DisplayName) and:
- Checks each server's status via API
- Called on startup via `On First Window Open` trigger

### `NAV: Home {skipVerifyDatabases}`
- Verifies plugins (if not done)
- Verifies databases (if not done)
- Navigates to Home or Admin Dashboard layout

---

## FileMaker Web Viewer Integration

### Credential Passing
FileMaker passes data to the Web Viewer via URL query parameters when constructing the Web Viewer URL. Example:
```
file:///path/to/index.html?host=<encoded>&user=<encoded>&pass=<encoded>&data=<json>
```
Or via `window.FileMakerData` object injected by FileMaker before page load.

### React → FileMaker Communication
```javascript
// Trigger a FileMaker script from React
if (window.FileMaker) {
  window.FileMaker.PerformScript(
    "Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}",
    JSON.stringify({ databaseID: id })
  );
}
```

### FileMaker → React (Data Refresh)
FileMaker can call a JavaScript function via:
```
Perform JavaScript In Web Viewer [ Object Name: "webviewer"; Function Name: "refreshData"; Parameter: $jsonData ]
```

### Vite Build for Single-File Output
Use `vite-plugin-singlefile` to inline all JS/CSS into a single `index.html`.
```
npm install vite-plugin-singlefile --save-dev
```
```js
// vite.config.js
import { viteSingleFile } from 'vite-plugin-singlefile'
export default { plugins: [react(), viteSingleFile()] }
```

---

## Visual Design (Matching FileMaker Portal)
- Light gray background (`#f0f0f0` or similar)
- Each row: thin horizontal rule separator
- Row height: ~50px (two-line layout with name + comments)
- Status badge: colored pill/badge (inline in row)
- Alternating row shading (standard FM portal style)
- Font: system-ui or SF Pro (matching FileMaker native)
- Click cursor on rows

### Status Badge Colors (to match FileMaker style)
| Status | Color |
|--------|-------|
| Ready | Green |
| Running | Blue |
| Update Available | Yellow/Amber |
| Stopped | Orange |
| Closed | Gray |
| Offline | Red |
| Users Blocked | Red/Orange |
| Failed | Red |

---

## API Documentation
Full API: https://fms.artistechendeavors.com/fmi/admin/apidoc/
Databases endpoint: https://fms.artistechendeavors.com/fmi/admin/apidoc/#tag/Databases/operation/databases
