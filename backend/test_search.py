import requests
import json

def run_search(query, platform="youtube"):
    print(f"\n--- Testing Search: {query} on {platform} ---")
    try:
        response = requests.get(
            f"http://localhost:8000/search?q={query}&platform={platform}",
            timeout=30
        )
        print(f"Status: {response.status_code}")
        if response.ok:
            results = response.json()
            print(f"Found {len(results)} results.")
            for r in results[:2]:
                print(f" - {r['title']} ({r['artist']})")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    run_search("Pendulum", "youtube")
    run_search("Pendulum", "soundcloud")
    run_search("Pendulum", "spotify")
