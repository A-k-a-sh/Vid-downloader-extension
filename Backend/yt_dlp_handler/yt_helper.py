import yt_dlp
import shutil
import os
import sys
class MyLogger:
    def debug(self, msg):
        pass
    def warning(self, msg):
        pass
    def error(self, msg):
        print(msg, file=sys.stderr)

def human_readable_size(size_bytes):
    """Convert bytes to human-readable format (KB, MB, GB)."""
    if size_bytes is None or size_bytes == 0:
        return "Unknown"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} TB"

def check_ffmpeg():
    """Check if FFmpeg is available. Checks known locations, PATH, then imageio-ffmpeg."""
    candidates = [
        '/opt/homebrew/bin/ffmpeg',          # macOS Homebrew (Apple Silicon)
        '/usr/local/bin/ffmpeg',              # macOS Homebrew (Intel) / Linux
        '/usr/bin/ffmpeg',                    # Linux apt
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    # Check system PATH (catches Windows manual installs and Chocolatey)
    found = shutil.which('ffmpeg')
    if found:
        return found
    # Last resort: imageio-ffmpeg ships a static binary, works on Windows with no manual install
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return None

def list_formats(video_url):
    """List available formats for the given URL, return JSON-serializable list."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': False,
        'extractor_args': {'youtube': {'player_client': ['web']}},
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            formats = info.get('formats', [])
            duration = info.get('duration', None)
            title = info.get('title', 'video')
            
        if not formats:
            print("No formats available for this URL.", file=sys.stderr)
            return [], title, duration
        
        # Find best audio format for calculating merged sizes
        best_audio = None
        best_audio_size = 0
        for f in formats:
            if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                audio_size = f.get('filesize') or f.get('filesize_approx') or 0
                if audio_size > best_audio_size:
                    best_audio_size = audio_size
                    best_audio = f
        
        # If no exact size, estimate from bitrate
        if best_audio and best_audio_size == 0 and duration:
            abr = best_audio.get('abr', 128)  # Default 128kbps
            best_audio_size = int(abr * duration * 1000 / 8)
        
        valid_formats = []
        for f in formats:
            if f.get('ext') not in ['mp4', 'webm', 'm4a', 'mp3'] or f.get('format_note', 'N/A') == 'storyboard':
                continue
            
            is_audio_only = f.get('vcodec') == 'none'
            is_video_only = f.get('acodec') == 'none' and f.get('vcodec') != 'none'
            
            # Get base size
            base_size = f.get('filesize') or f.get('filesize_approx')
            if not base_size and duration and f.get('tbr'):
                base_size = int(f.get('tbr', 0) * duration * 1000 / 8)
            
            # Calculate actual download size
            if is_audio_only:
                # Audio only - size is as shown
                actual_size = base_size
            elif is_video_only and best_audio_size > 0:
                # Video only - will be merged with audio, add both + 5% overhead
                actual_size = int((base_size or 0) + best_audio_size * 1.05) if base_size else None
            else:
                # Already has both video and audio
                actual_size = base_size
            
            valid_formats.append({
                'format_id': f.get('format_id', 'N/A'),
                'ext': f.get('ext', 'N/A'),
                'resolution': f.get('resolution', 'audio only' if is_audio_only else 'N/A'),
                'note': f.get('format_note', 'N/A'),
                'fps': str(f.get('fps', 'N/A')),
                'size': human_readable_size(actual_size)
            })
        
        return valid_formats, title, duration
    except Exception as e:
        print(f"Error fetching formats: {e}", file=sys.stderr)
        return [], None, None


def download_video(video_url, format_id, valid_formats):
    # Direct download to user's Downloads folder
    output_folder = os.path.expanduser('~/Downloads')
    os.makedirs(output_folder, exist_ok=True)

    ffmpeg_path = check_ffmpeg()
    is_audio_only = any(f['format_id'] == format_id and f.get('resolution') == 'audio only' for f in valid_formats)

    if not ffmpeg_path and not is_audio_only:
        print("FFmpeg not found and format requires video merging", file=sys.stderr)
        return False

    ydl_opts = {
        'outtmpl': f'{output_folder}/%(title)s.%(ext)s',
        'format': format_id if is_audio_only else f'{format_id}+bestaudio/best',
        'merge_output_format': None if is_audio_only else 'mp4',
        'ffmpeg_location': ffmpeg_path if ffmpeg_path else None,
        'quiet': True,
        'no_warnings': True,
        'logger': MyLogger(),
        'extractor_args': {'youtube': {'player_client': ['web']}},
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            # Get the actual downloaded filename
            downloaded_file = ydl.prepare_filename(info)
            # Check if file was merged to mp4
            if not is_audio_only and not os.path.exists(downloaded_file):
                # Try with .mp4 extension after merge
                base = os.path.splitext(downloaded_file)[0]
                downloaded_file = base + '.mp4'
        
        if os.path.exists(downloaded_file):
            return os.path.basename(downloaded_file)
        return False
    except Exception as e:
        print(f"Download error: {e}", file=sys.stderr)
        return False





def get_direct_url(video_url, format_id=None):
    ydl_opts = {
        'quiet': True,
        'format': format_id if format_id else 'bestvideo+bestaudio/best',
        'merge_output_format': 'mp4',
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        # If it's merged, it's in .url or .requested_formats
        if 'url' in info:
            return info['url']
        elif 'requested_formats' in info:
            return info['requested_formats'][0]['url']
        return None
