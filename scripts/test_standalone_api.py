import requests
import time
import subprocess
import os
import sys

def test_api():
    # Simulate a standalone launch with a custom token
    token = "flutter-test-token"
    port = "8999"
    
    env = os.environ.copy()
    env["LYRICVAULT_API_TOKEN"] = token
    env["LYRICVAULT_BACKEND_PORT"] = port
    
    print(f"Starting backend on port {port}...")
    backend_path = os.path.join(os.getcwd(), "backend", "main.py")
    
    # Use the same python executable running this script
    python_exe = sys.executable
    
    # Start backend
    proc = subprocess.Popen(
        [python_exe, backend_path],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    time.sleep(5) # Wait for startup
    
    url = f"http://127.0.0.1:{port}"
    headers = {"X-LyricVault-Token": token}
    
    try:
        print(f"Testing root endpoint...")
        r = requests.get(f"{url}/", headers=headers)
        print(f"Status: {r.status_code}, Response: {r.json()}")
        
        print(f"Testing library endpoint...")
        r = requests.get(f"{url}/library", headers=headers)
        print(f"Status: {r.status_code}")
        
        if r.status_code == 200:
            print(f"Songs in library: {len(r.json())}")
            print("\nSUCCESS: Backend is accessible via standard HTTP headers.")
            print("This confirms a Flutter client can interact with the existing backend.")
        else:
            print("\nFAILURE: Backend rejected the request.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Stopping backend...")
        proc.terminate()

if __name__ == "__main__":
    test_api()
