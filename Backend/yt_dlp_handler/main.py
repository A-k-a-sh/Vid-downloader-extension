import sys
import os
import json
import uuid
from yt_dlp import YoutubeDL
from yt_helper import list_formats, get_direct_url , download_video

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
class MyLogger:
    def debug(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        print(msg, file=sys.stderr)

def download_by_format(video_url, format_id):
    unique_name = f"{uuid.uuid4()}.mp4"
    output_path = os.path.join(DOWNLOAD_DIR, unique_name)

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': format_id,
        'merge_output_format': 'mp4',
        'outtmpl': output_path,
        'logger': MyLogger(),
    }


    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])

    return unique_name

def main():
    formats = []
    action = sys.argv[1]

    if action == 'formats':
        url = sys.argv[2]
        formats , title , duration = list_formats(url)
        print(json.dumps({
            "formats": formats, "title": title, "duration": duration
            }), flush=True)

    elif action == 'get_url':
        url = sys.argv[2]
        format_id = sys.argv[3]
        direct_url = get_direct_url(url, format_id)
        print(json.dumps({ "direct_url": direct_url }), flush=True)

    elif action == 'download':
        url = sys.argv[2]
        format_id = sys.argv[3]
        valid_formats, _, _ = list_formats(url)
        filename = download_video(url, format_id , valid_formats)
        print(json.dumps({ "filename": filename }), flush=True)

if __name__ == '__main__':
    main()
