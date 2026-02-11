import requests
import sys

def test_cors_null_origin():
    url = "http://localhost:8000/"
    headers = {
        "Origin": "null",
        "Access-Control-Request-Method": "GET"
    }
    try:
        # Preflight
        resp = requests.options(url, headers=headers, timeout=5)
        print(f"OPTIONS status: {resp.status_code}")
        print(f"Access-Control-Allow-Origin: {resp.headers.get('Access-Control-Allow-Origin')}")
        
        # Real request
        resp = requests.get(url, headers={"Origin": "null"}, timeout=5)
        print(f"GET status: {resp.status_code}")
        print(f"Access-Control-Allow-Origin: {resp.headers.get('Access-Control-Allow-Origin')}")
        
        if resp.headers.get('Access-Control-Allow-Origin') == "null":
            print("CORS SUCCESS: 'null' origin is correctly echoed.")
        else:
            print("CORS FAILURE: 'null' origin NOT echoed as expected.")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_cors_null_origin()
