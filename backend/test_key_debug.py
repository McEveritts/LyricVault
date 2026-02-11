"""Quick debug script to test Gemini API key validation."""
import sys
sys.path.append(".")

from google import genai

KEY = "AIzaSyDB2aXqih9PtJyxy8tcuUQ0XXvXJhmkaEY"

print(f"Testing key: {KEY[:8]}...{KEY[-4:]}")
print(f"google-genai version: {genai.__version__}")

try:
    client = genai.Client(api_key=KEY)
    print("Client created OK")
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Say hello in one word."
    )
    print(f"SUCCESS! Response: {response.text}")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
