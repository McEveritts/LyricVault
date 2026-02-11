
import sys
import os

# Ensure backend dir is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ingestor import ingestor

def test_ingest(url):
    print(f"\n--- Testing Ingestion: {url} ---")
    try:
        metadata = ingestor.download_audio(url)
        print("Success!")
        print(f"  Title: {metadata['title']}")
        print(f"  Artist: {metadata['artist']}")
        print(f"  File: {metadata['file_path']}")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False

# Test URLs
urls = [
    "https://www.youtube.com/watch?v=q-Mrc5WCtQo", # Dua Lipa - Houdini
    "https://soundcloud.com/eric-prydz/pjanoo-radio-edit",
    "https://open.spotify.com/track/1vY9lzUbe75I9lQ3kL7p4X" # Another Dua Lipa track
]


success = True
for url in urls:
    success &= test_ingest(url)

if success:
    print("\nALL INGESTION TESTS PASSED!")
    sys.exit(0)
else:
    print("\nSOME INGESTIONS FAILED.")
    sys.exit(1)
