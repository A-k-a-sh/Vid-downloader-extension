# yt-dlp Implementation Guide
## Production-Ready Patterns from Working Project

This guide documents battle-tested yt-dlp patterns from a production Chrome extension. Use these exact patterns to avoid common pitfalls.

---

## Installation & Dependencies

```bash
pip install yt-dlp
# Also requires FFmpeg for merging video+audio streams
brew install ffmpeg  # macOS
```

**Critical**: FFmpeg is required for merging separate video+audio streams, but NOT for audio-only downloads.

---

## Core Usage Pattern

### 1. Custom Logger (Suppress yt-dlp Output)

```python
import sys

class MyLogger:
    """Silent logger that only outputs errors to stderr"""
    def debug(self, msg):
        pass
    
    def warning(self, msg):
        pass
    
    def error(self, msg):
        print(msg, file=sys.stderr)
```

**Why**: yt-dlp is verbose by default. Use custom logger + `quiet: True` to control output when wrapping in APIs.

---

## Three Core Operations

### Operation 1: List Available Formats (No Download)

```python
import yt_dlp

def list_formats(video_url):
    """Extract all available formats without downloading."""
    ydl_opts = {
        'quiet': True,           # Suppress progress output
        'no_warnings': False,    # Keep warnings visible
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # download=False is CRITICAL - only fetches metadata
            info = ydl.extract_info(video_url, download=False)
            
            # Extract metadata
            formats = info.get('formats', [])
            duration = info.get('duration', None)  # seconds
            title = info.get('title', 'video')
            
        # Filter formats (avoid storyboard/unusable formats)
        valid_formats = [
            {
                'format_id': f.get('format_id', 'N/A'),
                'ext': f.get('ext', 'N/A'),
                'resolution': f.get('resolution', 
                    'audio only' if f.get('vcodec') == 'none' else 'N/A'),
                'note': f.get('format_note', 'N/A'),
                'fps': str(f.get('fps', 'N/A')),
                'size': calculate_size(f, duration)  # See helper below
            }
            for f in formats
            if f.get('ext') in ['mp4', 'webm', 'm4a', 'mp3'] 
            and f.get('format_note', 'N/A') != 'storyboard'
        ]
        
        return valid_formats, title, duration
        
    except Exception as e:
        print(f"Error fetching formats: {e}", file=sys.stderr)
        return [], None, None
```

**Key Info Fields Available:**
- `format_id`: Use this for downloads (e.g., "137", "251")
- `ext`: File extension (mp4, webm, m4a)
- `vcodec`: Video codec (or 'none' for audio-only)
- `acodec`: Audio codec (or 'none' for video-only)
- `resolution`: e.g., "1920x1080"
- `fps`: Frame rate
- `filesize` / `filesize_approx`: Bytes (often None)
- `tbr`: Total bitrate (kbps) - use to estimate size
- `format_note`: Quality label (e.g., "1080p", "medium")

---

### Operation 2: Download Video/Audio

```python
import os
import yt_dlp

def download_video(video_url, format_id, valid_formats):
    """Download specific format, handle video+audio merging."""
    
    output_folder = "./downloads"
    os.makedirs(output_folder, exist_ok=True)
    
    # Check if format is audio-only (no FFmpeg needed)
    is_audio_only = any(
        f['format_id'] == format_id and f.get('resolution') == 'audio only' 
        for f in valid_formats
    )
    
    # FFmpeg required for video+audio merging
    ffmpeg_path = check_ffmpeg()  # See helper below
    if not ffmpeg_path and not is_audio_only:
        raise Exception("FFmpeg required for video downloads")
    
    ydl_opts = {
        'outtmpl': f'{output_folder}/%(title)s.%(ext)s',  # Auto filename
        
        # Format selection:
        # Audio-only: use format_id directly
        # Video: merge video format + best audio
        'format': format_id if is_audio_only else f'{format_id}+bestaudio/best',
        
        # Force mp4 output for videos (requires FFmpeg)
        'merge_output_format': None if is_audio_only else 'mp4',
        
        'ffmpeg_location': ffmpeg_path if ffmpeg_path else None,
        'quiet': True,
        'no_warnings': True,
        'logger': MyLogger(),
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Get actual filename before download
            info = ydl.extract_info(video_url, download=False)
            file_name = ydl.prepare_filename(info)
            
            # Now download
            ydl.download([video_url])
            
        return os.path.basename(file_name)
        
    except Exception as e:
        print(f"Download failed: {e}", file=sys.stderr)
        return False
```

**Critical Patterns:**
- `format_id+bestaudio/best`: Merges specified video format with best available audio
- `outtmpl`: Use `%(title)s`, `%(ext)s`, `%(id)s` for dynamic filenames
- `prepare_filename()`: Get actual filename BEFORE download (handles sanitization)
- `merge_output_format`: Must match container format or FFmpeg converts

---

### Operation 3: Get Direct URL (Stream Without Download)

```python
def get_direct_url(video_url, format_id=None):
    """Extract direct URL for streaming (expires after ~6 hours)."""
    ydl_opts = {
        'quiet': True,
        'format': format_id if format_id else 'bestvideo+bestaudio/best',
        'merge_output_format': 'mp4',
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        
        # Single format (audio-only or pre-merged video)
        if 'url' in info:
            return info['url']
        
        # Multiple formats (video+audio) - return first (usually video)
        elif 'requested_formats' in info:
            return info['requested_formats'][0]['url']
        
        return None
```

**Important**: Direct URLs expire (typically 6 hours). Use for temporary streaming, not long-term storage.

---

## Helper Functions

### FFmpeg Detection (macOS-Optimized)

```python
import shutil
import os

def check_ffmpeg():
    """Check if FFmpeg is available, prioritize Homebrew path."""
    # Homebrew installs to /opt/homebrew on Apple Silicon
    ffmpeg_path = '/opt/homebrew/bin/ffmpeg'
    if os.path.exists(ffmpeg_path):
        return ffmpeg_path
    
    # Fallback to PATH search
    return shutil.which('ffmpeg')
```

**Why prioritize hardcoded path**: `shutil.which()` searches PATH, but Homebrew path may not be in Python's PATH depending on how it's spawned.

---

### File Size Calculation

```python
def human_readable_size(size_bytes):
    """Convert bytes to human-readable format."""
    if size_bytes is None or size_bytes == 0:
        return "Unknown"
    
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    
    return f"{size_bytes:.2f} TB"

def calculate_size(format_dict, duration):
    """Estimate file size from metadata."""
    # Priority: exact > approximate > calculate from bitrate
    size_bytes = (
        format_dict.get('filesize') or 
        format_dict.get('filesize_approx') or
        (format_dict.get('tbr', 0) * duration * 1000 / 8 
         if duration and format_dict.get('tbr') else None)
    )
    return human_readable_size(size_bytes)
```

**Why calculate from bitrate**: YouTube often doesn't provide exact file sizes. Formula: `bitrate (kbps) * duration (s) * 1000 / 8 = bytes`

---

## CLI Wrapper Pattern (Node.js Integration)

```python
# main.py - CLI interface for spawning from Node.js
import sys
import json
from yt_helper import list_formats, get_direct_url, download_video

def main():
    action = sys.argv[1]
    
    if action == 'formats':
        url = sys.argv[2]
        formats, title, duration = list_formats(url)
        print(json.dumps({
            "formats": formats, 
            "title": title, 
            "duration": duration
        }), flush=True)  # flush=True ensures immediate output
    
    elif action == 'get_url':
        url = sys.argv[2]
        format_id = sys.argv[3]
        direct_url = get_direct_url(url, format_id)
        print(json.dumps({"direct_url": direct_url}), flush=True)
    
    elif action == 'download':
        url = sys.argv[2]
        format_id = sys.argv[3]
        valid_formats, _, _ = list_formats(url)
        filename = download_video(url, format_id, valid_formats)
        print(json.dumps({"filename": filename}), flush=True)

if __name__ == '__main__':
    main()
```

**Node.js spawn pattern:**

```javascript
import { spawn } from 'child_process';

const python = spawn('python3', ['main.py', 'formats', videoUrl]);

let stdout = '';
let stderr = '';

python.stdout.on('data', (data) => {
    stdout += data.toString();
});

python.stderr.on('data', (data) => {
    stderr += data.toString();
});

python.on('close', (code) => {
    if (code !== 0) {
        console.error('Error:', stderr);
        return;
    }
    const result = JSON.parse(stdout);
    console.log(result);
});
```

**Why this pattern**:
- Python outputs JSON to stdout → Node.js parses once process completes
- Errors to stderr → keeps stdout clean for JSON
- `flush=True` → ensures buffered output writes immediately

---

## Common yt-dlp Options Reference

```python
ydl_opts = {
    # Output Control
    'outtmpl': '/path/%(title)s.%(ext)s',  # Output filename template
    'restrictfilenames': True,              # ASCII-only filenames
    
    # Format Selection
    'format': 'bestvideo+bestaudio/best',  # Fallback chain
    'format': '137+251',                    # Specific format IDs
    'format': 'bestaudio',                  # Audio only
    'merge_output_format': 'mp4',           # Container for merged streams
    
    # Download Control
    'noplaylist': True,                     # Download single video, not playlist
    'playlist_items': '1-5',                # Download specific playlist items
    
    # Post-Processing
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
    
    # Network
    'socket_timeout': 10,
    'retries': 3,
    
    # Logging
    'quiet': True,
    'no_warnings': True,
    'logger': MyLogger(),
    
    # FFmpeg
    'ffmpeg_location': '/path/to/ffmpeg',
    
    # Cookies (for age-restricted/private videos)
    'cookiefile': '/path/to/cookies.txt',
}
```

---

## Format Selection Syntax

| Pattern | Meaning |
|---------|---------|
| `bestvideo+bestaudio` | Best video + best audio, merge with FFmpeg |
| `bestvideo+bestaudio/best` | Try merge, fallback to best single-file format |
| `137+251` | Specific format IDs (e.g., 1080p video + opus audio) |
| `best[height<=720]` | Best format with max 720p height |
| `bestaudio/best` | Audio-only preferred, fallback to video |
| `worst` | Lowest quality (for testing) |

**Important**: YouTube separates high-quality video and audio. Use `+` to merge (requires FFmpeg).

---

## Common Pitfalls & Solutions

### 1. Missing FFmpeg
**Symptom**: Downloads fail for video formats  
**Solution**: Check FFmpeg availability before downloads, allow audio-only bypass

### 2. Storyboard Formats
**Symptom**: Weird thumbnail grid "videos" in format list  
**Solution**: Filter `format_note != 'storyboard'`

### 3. File Already Exists
**Symptom**: Download succeeds but file not found  
**Solution**: Use `prepare_filename()` to get actual filename (handles duplicates)

### 4. Expired Direct URLs
**Symptom**: Stream URL returns 403 after hours  
**Solution**: Re-fetch URLs just before use, don't cache long-term

### 5. Python Not in PATH
**Symptom**: Node.js spawn fails with "python3 not found"  
**Solution**: Use absolute Python path or activate virtualenv before spawning

### 6. Buffering Issues
**Symptom**: Node.js stdout incomplete  
**Solution**: Always use `flush=True` in Python `print()` statements

---

## Testing Checklist

- [ ] Audio-only format (no FFmpeg needed)
- [ ] Video format requiring FFmpeg merge
- [ ] Age-restricted video (may need cookies)
- [ ] Private/unlisted video
- [ ] Expired/deleted video (error handling)
- [ ] Very long filename (special characters)
- [ ] Playlist URL with `noplaylist=True`
- [ ] No internet connection (timeout handling)

---

## Performance Notes

- **Metadata fetch (`download=False`)**: ~1-3 seconds
- **High-quality download (1080p)**: ~5-30 seconds per video (network-dependent)
- **FFmpeg merging**: Adds 2-5 seconds to download time
- **Direct URL extraction**: ~1-2 seconds (same as metadata fetch)

---

## Security Considerations

1. **Validate URLs**: Check URL format before passing to yt-dlp
2. **Limit output paths**: Use `os.path.abspath()` to prevent directory traversal
3. **Sanitize filenames**: yt-dlp does this by default, but verify for edge cases
4. **Rate limiting**: Add delays between downloads to avoid IP bans
5. **User input**: Never pass unsanitized user input directly to yt-dlp options

---

## Example: Complete Implementation

```python
#!/usr/bin/env python3
import sys
import os
import json
import yt_dlp
import shutil

class MyLogger:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): print(msg, file=sys.stderr)

def check_ffmpeg():
    ffmpeg_path = '/opt/homebrew/bin/ffmpeg'
    if os.path.exists(ffmpeg_path):
        return ffmpeg_path
    return shutil.which('ffmpeg')

def list_formats(video_url):
    ydl_opts = {'quiet': True, 'no_warnings': False}
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            formats = info.get('formats', [])
            title = info.get('title', 'video')
            
        valid = [
            {
                'format_id': f.get('format_id'),
                'ext': f.get('ext'),
                'resolution': f.get('resolution', 
                    'audio only' if f.get('vcodec') == 'none' else 'N/A'),
                'note': f.get('format_note', 'N/A'),
            }
            for f in formats
            if f.get('ext') in ['mp4', 'webm', 'm4a']
        ]
        
        return valid, title
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return [], None

def download_video(video_url, format_id):
    output_folder = "./downloads"
    os.makedirs(output_folder, exist_ok=True)
    
    ydl_opts = {
        'outtmpl': f'{output_folder}/%(title)s.%(ext)s',
        'format': f'{format_id}+bestaudio/best',
        'merge_output_format': 'mp4',
        'ffmpeg_location': check_ffmpeg(),
        'quiet': True,
        'logger': MyLogger(),
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        filename = ydl.prepare_filename(info)
        ydl.download([video_url])
        
    return os.path.basename(filename)

if __name__ == '__main__':
    action = sys.argv[1]
    url = sys.argv[2]
    
    if action == 'formats':
        formats, title = list_formats(url)
        print(json.dumps({'formats': formats, 'title': title}), flush=True)
    
    elif action == 'download':
        format_id = sys.argv[3]
        filename = download_video(url, format_id)
        print(json.dumps({'filename': filename}), flush=True)
```

---

## TL;DR - Copy-Paste Starter

```python
import yt_dlp

# List formats
with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
    info = ydl.extract_info(url, download=False)
    formats = info.get('formats', [])
    title = info.get('title')

# Download best quality
ydl_opts = {
    'format': 'bestvideo+bestaudio/best',
    'outtmpl': './downloads/%(title)s.%(ext)s',
    'merge_output_format': 'mp4',
}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download([url])
```

**Give this document to an AI agent**, and they can implement yt-dlp functionality without trial and error. All patterns are production-tested.
