import requests
import json

BASE_URL = "http://localhost:8000"

def test_malformed_ingest():
    print("Testing malformed ingest URL...")
    payload = {"url": "javascript:alert(1)", "rehydrate": False}
    resp = requests.post(f"{BASE_URL}/ingest", json=payload)
    print(f"Status: {resp.status_code}, Response: {resp.json()}")

def test_unsupported_platform():
    print("\nTesting unsupported platform...")
    payload = {"url": "https://example.com/audio.mp3", "rehydrate": False}
    resp = requests.post(f"{BASE_URL}/ingest", json=payload)
    print(f"Status: {resp.status_code}, Response: {resp.json()}")

def test_large_payload():
    print("\nTesting large search query...")
    large_q = "A" * 10000
    resp = requests.get(f"{BASE_URL}/search", params={"q": large_q, "platform": "youtube"})
    print(f"Status: {resp.status_code}")

def test_unicode_search():
    print("\nTesting unicode search...")
    query = "音乐" # Music in Chinese
    resp = requests.get(f"{BASE_URL}/search", params={"q": query, "platform": "youtube"})
    print(f"Status: {resp.status_code}, Results Count: {len(resp.json()) if resp.ok else 'Error'}")

if __name__ == "__main__":
    try:
        test_malformed_ingest()
        test_unsupported_platform()
        test_large_payload()
        test_unicode_search()
    except Exception as e:
        print(f"Test aborted: {e}")
