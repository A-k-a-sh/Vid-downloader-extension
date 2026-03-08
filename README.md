# Vid Downloader Extension

A Chrome extension for downloading videos from YouTube and other supported sites. The extension UI triggers a local backend server that handles downloads via yt-dlp, saving files directly to your Downloads folder.

## Architecture

```
Extension (React popup)
    |
    | HTTP (localhost:8080)
    |
Express Server (Node.js)
    |
    | child_process.spawn
    |
Python (yt-dlp handler)
    |
    | saves to ~/Downloads
```

The backend runs locally on your machine. The extension popup communicates with it over HTTP. Node.js spawns Python as a child process for each request, passing arguments via CLI and receiving JSON via stdout.

## Requirements

- Node.js
- Python 3
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — `pip install yt-dlp`
- [FFmpeg](https://ffmpeg.org/) — required for merging video and audio streams

On macOS with Homebrew:

```bash
brew install ffmpeg
pip install yt-dlp
```

## Setup

### Backend

```bash
cd Backend
npm install
node index.js
```

Server starts on port `8080`. Keep this running while using the extension.

### Frontend (Extension)

```bash
cd Frontend
npm install
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `Frontend/dist` folder

## Usage

1. Start the backend server
2. Open the extension from the Chrome toolbar
3. Click **Use Current Page URL** to auto-fill the current tab's URL, or paste a URL manually
4. Click **Download** to fetch available formats
5. Select a format and click the download button next to it
6. The file is saved directly to `~/Downloads`

## Project Structure

```
Backend/
  index.js                   # Express server, 3 endpoints
  yt_dlp_handler/
    main.py                  # CLI entry point, dispatches actions
    yt_helper.py             # Core yt-dlp logic (formats, download, direct URL)
    downloads/               # Temporary working directory (files moved to ~/Downloads)

Frontend/
  src/
    components/
      VidDownloader.jsx      # Main UI — all state, format listing, download logic
    background.js            # Service worker — handles getTabUrl message
    content.js               # Content script — collects video URLs from page
  public/
    manifest.json            # Chrome Manifest v3 config
  vite.config.js             # Build config — outputs popup, background, content as separate bundles
```

## API Endpoints

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | `/formats` | `url` | Fetch available formats and metadata for a video |
| GET | `/download` | `url`, `format` | Download a specific format to `~/Downloads` |
| GET | `/get-download-url` | `url`, `format` | Return the direct CDN URL without downloading |

## Notes

- The backend URL is hardcoded to `http://localhost:8080` in `VidDownloader.jsx`
- FFmpeg is required for any video format that needs merging (video-only + audio streams). Audio-only formats do not require FFmpeg
- The extension uses `localStorage` with a `viddownloader_` prefix to persist state across popup opens
- Displayed file sizes include the estimated audio stream size for video formats, giving a more accurate pre-download estimate
- The Vercel config in `Backend/vercel.json` is non-functional — Python + yt-dlp cannot run on Vercel's serverless runtime. The backend must be self-hosted

## Development

For frontend development with hot reload (note: extension APIs like `chrome.runtime` won't work in this mode):

```bash
cd Frontend
npm run dev
```

To rebuild after making changes:

```bash
cd Frontend
npm run build
# Then reload the extension in chrome://extensions
```
