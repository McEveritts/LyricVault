import yt_dlp

def test_search(platform, query):
    prefix = {
        "tiktok": "tiktoksearch1:",
    }.get(platform, "")
    
    print(f"Testing {platform} with query '{query}'...")
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'noplaylist': True}) as ydl:
            info = ydl.extract_info(f"{prefix}{query}", download=False)
            if 'entries' in info:
                entries = list(info['entries'])
                print(f"{platform}: Found {len(entries)} results")
                if entries:
                    print(f"Sample: {entries[0].get('title')} - {entries[0].get('webpage_url')}")
            else:
                print(f"{platform}: No entries found (info type: {type(info)})")
    except Exception as e:
        print(f"{platform} failed: {e}")

if __name__ == "__main__":
    test_search("tiktok", "funny cat")
