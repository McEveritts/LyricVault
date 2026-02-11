
import sys
import os

# Ensure backend dir is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ingestor import ingestor

def verify_search(platform, query):
    print(f"\n--- Testing Search: {platform} (Query: {query}) ---")
    try:
        results = ingestor.search_platforms(query, platform)
        if results:
            print(f"Success! Found {len(results)} results.")
            for i, res in enumerate(results[:2]):
                print(f"  {i+1}. {res['title']} by {res['artist']} ({res['url']})")
        else:
            print(f"FAILED: No results returned for {platform}")
        return bool(results)
    except Exception as e:
        print(f"ERROR: {e}")
        return False

# Test cases
success = True
success &= verify_search("youtube", "Birds of a feather")
success &= verify_search("soundcloud", "House music mix")
success &= verify_search("spotify", "Houdini Dua Lipa")

if success:
    print("\nALL PLATFORM SEARCHES VERIFIED SUCCESSFULLY!")
    sys.exit(0)
else:
    print("\nSOME SEARCHES FAILED.")
    sys.exit(1)
