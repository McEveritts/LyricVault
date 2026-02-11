"""Quick ingest test"""
import requests
import json

try:
    response = requests.post(
        "http://localhost:8000/ingest",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        timeout=120
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except requests.exceptions.Timeout:
    print("Request timed out after 120 seconds")
except Exception as e:
    print(f"Error: {e}")
