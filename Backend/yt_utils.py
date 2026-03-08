# yt_utils.py
import yt_dlp
import os
import shutil

def human_readable_size(size_bytes):
    if size_bytes is None or size_bytes == 0:
        return "Unknown"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} TB"

def check_ffmpeg():
    if os.path.exists('/opt/homebrew/bin/ffmpeg'):
        return '/opt/homebrew/bin/ffmpeg'
    return shutil.which('ffmpeg')

def list_formats(video_url):
    ydl_opts = {'quiet': True, 'no_warnings': False}
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        formats = info.get('formats', [])
        duration = info.get('duration')
        title = info.get('title', 'video')

    valid_formats = []
    for fmt in formats:
        if fmt.get('ext') not in ['mp4', 'webm', 'm4a', 'mp3']:
            continue
        if fmt.get('format_note') == 'storyboard':
            continue
        
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        if not filesize and duration and fmt.get('tbr'):
            filesize = (fmt.get('tbr') * duration * 1000) / 8

        valid_formats.append({
            'format_id': fmt.get('format_id'),
            'ext': fmt.get('ext'),
            'note': fmt.get('format_note', 'N/A'),
            'resolution': 'audio only' if fmt.get('vcodec') == 'none' else fmt.get('resolution', 'N/A'),
            'fps': fmt.get('fps', 'N/A'),
            'size': human_readable_size(filesize)
        })
    
    return {
        'title': title,
        'formats': valid_formats
    }

def get_direct_url(video_url, format_id):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'forceurl': True,
        'format': format_id
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        if 'url' in info:
            return info['url']
        elif 'requested_formats' in info:
            return info['requested_formats'][0]['url']
        else:
            raise Exception("Unable to find direct URL.")
