
import sys
import os

# Ensure backend dir is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ingestor import ingestor

URL = "https://www.youtube.com/watch?v=-hLG0n_JBzI"

print("Testing ingestor.download_audio...")
try:
    result = ingestor.download_audio(URL)
    print("Success!")
    print(result)
except Exception as e:
    print(f"Caught exception: {e}")
    import traceback
    traceback.print_exc()
