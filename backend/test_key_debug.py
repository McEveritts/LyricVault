"""Quick debug script to test Gemini API key validation."""
import sys
import os
sys.path.append(".")

from dotenv import load_dotenv
from google import genai

def main():
    load_dotenv()
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment")

    print(f"Testing key: {key[:8]}...{key[-4:]}")
    print(f"google-genai version: {genai.__version__}")

    try:
        client = genai.Client(api_key=key)
        print("Client created OK")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say hello in one word."
        )
        print(f"SUCCESS! Response: {response.text}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

if __name__ == "__main__":
    main()
