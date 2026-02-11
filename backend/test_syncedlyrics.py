import syncedlyrics

print("Testing syncedlyrics...")
try:
    lrc = syncedlyrics.search("Rick Astley Never Gonna Give You Up")
    if lrc:
        print("Success! Lyrics found.")
        print(lrc[:50])
    else:
        print("Failed. No lyrics found for known song.")
except Exception as e:
    print(f"Error: {e}")
