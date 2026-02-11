import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def test_ingest(url):
    print(f"Testing ingestion for: {url}")
    resp = requests.post(f"{BASE_URL}/ingest", json={"url": url})
    if resp.status_code != 202:
        print(f"Error: Expected 202, got {resp.status_code}")
        print(resp.text)
        return
    
    job = resp.json()
    job_id = job['id']
    print(f"Job created: {job_id} (Status: {job['status']})")
    
    # Poll for status
    while True:
        status_resp = requests.get(f"{BASE_URL}/jobs/{job_id}")
        job_data = status_resp.json()
        print(f"Job {job_id} status: {job_data['status']} | Progress: {job_data['progress']}%")
        
        if job_data['status'] == "completed":
            print("Job completed successfully!")
            print(f"Result: {job_data.get('result_json')}")
            break
        elif job_data['status'] == "failed":
            print(f"Job failed: {job_data.get('last_error')}")
            break
            
        time.sleep(2)

if __name__ == "__main__":
    # You might need to start the backend in a separate terminal before running this
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ" # Never gonna give you up
    test_ingest(test_url)
