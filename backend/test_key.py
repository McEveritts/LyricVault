
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

key = os.getenv('GEMINI_API_KEY')
print(f"Testing Key: {key[:5]}...{key[-5:] if key else ''}")

try:
    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Reply with 'SUCCESS'"
    )
    print(f"Response: {response.text}")
except Exception as e:
    print(f"ERROR: {e}")
