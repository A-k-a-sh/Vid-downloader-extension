# Video Downloader Extension - AI Coding Instructions

## Project Overview
Hybrid browser extension (Chrome Manifest v3) for video downloads with:
- **Frontend**: React + Vite + Tailwind CSS browser extension (popup UI, background worker, content script)
- **Backend**: Node.js Express server spawning Python child processes
- **Python Handler**: yt-dlp wrapper for video format extraction and downloading

## Architecture & Data Flow

### Request Flow
1. Extension popup → Backend Express API (`/formats`, `/download`, `/get-download-url`)
2. Node.js spawns `python3` process → `Backend/yt_dlp_handler/main.py` with action args
3. Python executes yt-dlp operations, prints JSON to stdout
4. Node.js parses stdout JSON → returns to frontend via HTTP

### Key Files
- **Backend/index.js**: Express server with 3 endpoints, spawns Python via `child_process`
- **Backend/yt_dlp_handler/main.py**: CLI interface (`formats`, `get_url`, `download` actions)
- **Backend/yt_dlp_handler/yt_helper.py**: Core yt-dlp functions (format listing, downloads)
- **Frontend/src/components/VidDownloader.jsx**: Main UI logic (~460 lines)
- **Frontend/vite.config.js**: Critical build config for extension bundling

## Critical Patterns & Conventions

### Python-Node.js Communication
- **Python outputs JSON to stdout**: `print(json.dumps({...}), flush=True)`
- **Errors to stderr**: `print(msg, file=sys.stderr)`
- Node.js accumulates stdout/stderr in buffers, parses on process close
- Example spawn: `spawn('python3', [scriptPath, 'formats', videoUrl])`

### State Persistence (Frontend)
All extension state uses localStorage with `viddownloader_` prefix:
```javascript
localStorage.setItem('viddownloader_pastedVideoUrl', JSON.stringify(url))
localStorage.getItem('viddownloader_theme') // 'light' or 'dark'
```
State restored on mount via `getStorageItem()` helpers in VidDownloader.jsx.

### FFmpeg Dependency
Python checks hardcoded Homebrew path first: `/opt/homebrew/bin/ffmpeg`
Falls back to `shutil.which('ffmpeg')`. Required for merging video+audio streams.
Audio-only formats skip FFmpeg requirement.

### File Handling
- Downloads to `Backend/yt_dlp_handler/downloads/`
- Node.js sends file via `res.download()`, then `fs.unlink()` cleanup
- **Bug**: `fs.unlinkSync('./yt_dlp_handler/downloads')` attempts to delete symlink before download

### Extension Build Process
Vite config (`Frontend/vite.config.js`) outputs:
- `index.html` → popup UI (React app)
- `background.js` → service worker (separate entry point)
- `content.js` → content script (separate entry point)
- All bundled to `Frontend/dist/`, manually copied to browser

## Development Workflows

### Backend Development
```bash
cd Backend
npm install  # No start script defined - must run manually
node index.js  # Starts on port 8080
# Requires: python3, yt-dlp installed, ffmpeg for video merging
```

### Frontend Development
```bash
cd Frontend
npm install
npm run dev    # Vite dev server (NOT extension mode)
npm run build  # Outputs to dist/ - load unpacked in browser
```

### Extension Loading
1. Build: `cd Frontend && npm run build`
2. Chrome: `chrome://extensions` → Load unpacked → select `Frontend/dist/`
3. Ensure `Frontend/public/manifest.json` copied to `dist/` during build

### Testing Against Backend
Extension hardcoded to `http://localhost:8080` (see `serverUrl` in VidDownloader.jsx).
**No environment variables** - change directly in code for different backend URLs.

## Common Pitfalls

1. **Symlink deletion bug**: Line 66 in `Backend/index.js` tries `fs.unlinkSync('./yt_dlp_handler/downloads')` which breaks if downloads is a directory
2. **Python executable**: Code expects `python3` command, may fail if system uses `python`
3. **No error boundaries**: Extension UI crashes on API failures - add try/catch in axios calls
4. **Manifest not in build**: Vite doesn't auto-copy `manifest.json` - manually handle in build process
5. **CORS in production**: Backend uses `cors()` with no config - locks to all origins
6. **No TypeScript**: Pure JavaScript - no type checking

## Key Dependencies
- **yt-dlp**: Python library (not in requirements.txt - must install manually)
- **FFmpeg**: System binary for video merging
- **lucide-react**: Icon library (e.g., `<Download />`, `<MoonIcon />`)
- **axios**: HTTP client (not fetch)

## Deployment Notes
- **Vercel config** (`Backend/vercel.json`) exists but **Python handler won't work** on Vercel (no python3 runtime with yt-dlp)
- Backend designed for self-hosted deployment where Python + FFmpeg available
- Extension must be submitted to Chrome Web Store (not auto-deployable)

## Extension Communication Patterns
```javascript
// Popup → Background: Get active tab URL
chrome.runtime.sendMessage({ action: "getTabUrl" }, (response) => {
  console.log(response.url)
})

// Content script → Background: Send video URLs
chrome.runtime.sendMessage({ action: 'videoUrls', urls: videos })
```
Background listener in `Frontend/src/background.js` handles `getTabUrl` action only.
