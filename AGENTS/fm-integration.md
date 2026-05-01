# FileMaker Integration Guide

This document explains how to wire the compiled React app into a FileMaker Web Viewer on the Home layout of Lackner Connect.

---

## 1. Build Output

After running `npm run build`, the entire app compiles to a **single file**:
```
dist/index.html   (~202 kB, all JS and CSS inlined)
```
No web server required. This file can be:
- Stored in a FileMaker container field
- Placed at a known local path on the client machine
- Hosted on a web server (optional)

---

## 2. Web Viewer URL Construction

### From a local file path (recommended for development)
```
"file://" & Get(DesktopPath) & "index.html" &
"?host=" & URLEncode ( FMSServerList::baseConfig_IPAddress_t ) &
"&port=" & URLEncode ( FMSServerList::baseConfig_IPAddress_APIPort_t ) &
"&username=" & URLEncode ( FMSServerList::adminConsole_customLogin_t ) &
"&password=" & URLEncode ( FMSServerList::adminConsole_customPassword_t )
```

### From a container field
Store the compiled `index.html` in a FileMaker container field (e.g. `Session::WebViewerHTML_c`). Use:
```
"container:" & GetAsURL ( Session::WebViewerHTML_c ) & "?host=..."
```

### Query Parameters
| Parameter | Value | Example |
|-----------|-------|---------|
| `host` | Server IP or hostname | `192.168.1.10` |
| `port` | Admin API port | `443` |
| `username` | Admin API username | `admin` |
| `password` | Admin API password | `••com` |
| `databases` | (Optional) Pre-fetched JSON array | `[{"databaseID":"1","displayName":"MyDB",...}]` |

All parameters must be URL-encoded (use FileMaker's `URLEncode()` function).

---

## 3. Pre-fetching Data (Bypass Direct API Calls)

If the Web Viewer cannot make direct HTTPS calls to the FMS Admin API (e.g. due to CORS), FileMaker can pre-fetch all data via its own scripts and pass it to the React app as the `databases` JSON parameter.

### JSON format for `databases` parameter
Each entry should match this structure:
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

### Status values (matching Lackner Connect `Status_ct` field)
`Ready` | `Running` | `Update Available` | `Stopped` | `Closed` | `Offline` | `Users Blocked` | `Failed`

### FileMaker calculation to build the JSON
```
Let([
  ~databases = "";
  ~i = 1;
  // Loop over Databases portal rows and build JSON array
  // Use JSONSetElement to build each entry
];
URLEncode ( ~databases )
)
```

---

## 4. Refreshing Data from FileMaker

After the Web Viewer has loaded, FileMaker can push updated data at any time using:

```
Perform JavaScript in Web Viewer [
  Object Name: "serverListViewer";
  Function Name: "refreshData";
  Parameters: $databasesJson  // JSON array string OR empty string to trigger re-fetch
]
```

The React app exposes `window.refreshData(data)`:
- Pass a JSON array → replaces the displayed list immediately
- Pass an empty string or omit → triggers a fresh API fetch

---

## 5. Row Click → FileMaker Script

When a user clicks a database row, the React app calls:
```javascript
window.FileMaker.PerformScript(
  "Button: Launch DB {databaseID,forceUpdatePrompt,isAutoStart}",
  JSON.stringify({ databaseID: "1" })
)
```
This is the **exact same script** called by the existing portal buttons — no changes to FileMaker scripts required.

---

## 6. CORS Considerations

The FMS Admin API may block requests from `file://` origins. If this occurs:

### Option A: Use Pre-fetched Data (recommended)
Have FileMaker build the `databases` JSON (see Section 3) and pass it as a URL parameter. The React app will render it directly without making any API calls.

### Option B: Host the app on a web server
Deploy `dist/index.html` to a web server (or the FMS web root) and load it via `https://`. FMS Admin API allows same-origin HTTPS requests.

### Option C: Configure FMS CORS
In the FMS Admin Console → Configuration → Security, add the allowed origin (e.g. `file://` or the hosting domain).

---

## 7. Web Viewer Object Setup in FileMaker

1. In Layout mode on the **Home** layout, replace the `Session|Databases` portal with a **Web Viewer** object
2. Set the Web Viewer object name to `serverListViewer`
3. Set the URL to the calculation from Section 2
4. Enable: ☑ Allow JavaScript to perform FileMaker scripts
5. Set the Web Viewer to the same size as the portal it replaces

---

## 8. Development & Testing

### Local dev server
```bash
npm run dev
```
Opens at `http://localhost:5173`. Pass test parameters via URL:
```
http://localhost:5173?host=fms.example.com&port=443&username=admin&password=test
```

### Build for FileMaker
```bash
npm run build
# Output: dist/index.html
```

### Test with mock data (no FileMaker connection)
Open `dist/index.html` directly in a browser with the `databases` param:
```
file:///path/to/dist/index.html?databases=[{"databaseID":"1","displayName":"Test DB","status":"Ready","lastVersion":"21.0","generalStatus":"2 of 3 open","isClickable":true}]
```
