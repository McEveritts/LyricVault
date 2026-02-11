
import sys
import os

# Ensure backend dir is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import yt_dlp

print(f"yt-dlp version: {yt_dlp.version.__version__}")

URL = "https://www.youtube.com/watch?v=-hLG0n_JBzI"

try:
    print("Attempting to initialize YoutubeDL...")
    with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
        print("Extracting info...")
        info = ydl.extract_info(URL, download=False)
        print("Success!")
        print(f"Title: {info.get('title')}")
except Exception as e:
    print(f"Caught exception: {e}")
    import traceback
    traceback.print_exc()
