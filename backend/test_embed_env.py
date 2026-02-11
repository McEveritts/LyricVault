import sys
import os

# Add site-packages to path if not already there (mimic what the app does if needed)
# In embedded python, site-packages should be auto-discovered if layout is standard.

print(f"Python Executable: {sys.executable}")
print(f"Python Version: {sys.version}")
print(f"System Path: {sys.path}")

try:
    import certifi
    print(f"Certifi path: {certifi.where()}")
    print(f"Certifi exists: {os.path.exists(certifi.where())}")
except ImportError:
    print("Certifi NOT installed")

try:
    from google import genai
    print(f"Google GenAI Version: {genai.__version__}")
    
    KEY = "AIzaSyDB2aXqih9PtJyxy8tcuUQ0XXvXJhmkaEY"
    client = genai.Client(api_key=KEY)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Hello"
    )
    print("SUCCESS: API Call worked!")
    print(response.text)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
