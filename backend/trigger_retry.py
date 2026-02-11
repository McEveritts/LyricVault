import requests
import time

URL = "http://localhost:8000/retry_lyrics/1"
try:
    response = requests.post(URL)
    print(response.json())
except Exception as e:
    print(f"Error: {e}")
